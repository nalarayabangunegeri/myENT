import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { generateSecret, keyuri, verifyTotp } from './totp';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// Hash pembanding agar waktu respons NIM-tak-ada ≈ password-salah (anti timing oracle).
const DUMMY_HASH = bcrypt.hashSync('dummy-tidak-pernah-cocok', 10);

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private refreshDays() {
    return Number(this.config.get('REFRESH_EXPIRES_DAYS') ?? 14);
  }

  private async issueTokens(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    const raw = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshDays() * 86400_000);
    await this.prisma.session.create({
      data: { userId: user.id, refreshTokenHash: sha256(raw), expiresAt },
    });
    return { accessToken, refreshToken: raw, mustChangePassword: user.mustChangePassword };
  }

  async login(nim: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { nim } });
    // Generic message agar tidak bocor enumerasi — PRD §18.
    if (!user || user.status !== 'ACTIVE') {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('NIM atau password salah');
    }
    // Lockout sementara DB-backed, selamat dari restart (PRD §6.3).
    const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new UnauthorizedException('Akun terkunci sementara, coba lagi nanti');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed,
          ...(failed >= maxAttempts
            ? { lockedUntil: new Date(Date.now() + Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15) * 60_1000) }
            : {}),
        },
      });
      await this.audit.log(
        { actorId: user.id, action: 'auth.login-failed', entity: 'User', entityId: user.id },
      ).catch(() => {});
      throw new UnauthorizedException('NIM atau password salah');
    }
    if (user.failedLogins > 0 || user.lockedUntil)
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    // 2FA aktif → langkah kedua via token sekali-pakai 5 menit.
    if (user.totpEnabled && user.totpSecret) {
      const pendingToken = await this.jwt.signAsync({ sub: user.id, purpose: '2fa' }, { expiresIn: '5m' } as any);
      return { twoFactorRequired: true, pendingToken };
    }
    return this.issueTokens(user.id);
  }

  async refresh(raw: string) {
    const sess = await this.prisma.session.findUnique({
      where: { refreshTokenHash: sha256(raw) },
      include: { user: true },
    });
    if (!sess || sess.revokedAt || sess.expiresAt < new Date() || sess.user.status !== 'ACTIVE')
      throw new UnauthorizedException('Unauthorized');
    await this.prisma.session.update({
      where: { id: sess.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(sess.userId);
  }

  async logout(raw: string) {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: sha256(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Password lama salah');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log(
        { actorId: userId, action: 'user.change-password', entity: 'User', entityId: userId },
        tx as any,
      );
    });
    return { ok: true };
  }

  async resetPassword(actorId: string, targetId: string) {    const temp = randomBytes(9).toString('base64url'); // ~12 char, sekali tampil — PRD §6.2
    const passwordHash = await bcrypt.hash(temp, 10);
    await this.prisma.$transaction(async (tx: any) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id: targetId } });
      await tx.user.update({
        where: { id: targetId },
        data: { passwordHash, mustChangePassword: true },
      });
      await tx.session.updateMany({ where: { userId: targetId }, data: { revokedAt: new Date() } });
      await this.audit.log(
        {
          actorId,
          action: 'user.reset-password',
          entity: 'User',
          entityId: targetId,
          oldValue: { mustChangePassword: before.mustChangePassword } as any,
          newValue: { mustChangePassword: true } as any,
        },
        tx as any,
      );
    });
    return { temporaryPassword: temp };
  }

  // P1: reset mandiri via email (PRD §6.2). Selalu 200 agar tak bocor enumerasi.
  async forgotPassword(nim: string) {
    const user = await this.prisma.user.findUnique({ where: { nim } });
    if (user && user.status === 'ACTIVE' && user.email) {
      const raw = randomBytes(32).toString('hex');
      await this.prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3600_1000) },
      });
      await this.sendMail(
        user.email,
        'Reset password JURNALISTIK APP',
        `Tautan reset (1 jam): ${(process.env.WEB_URL ?? '').replace(/\/$/, '')}/reset?token=${raw}`,
      );
    }
    return { ok: true };
  }

  async resetViaEmail(token: string, newPassword: string) {
    const rec = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new UnauthorizedException('Tautan tidak valid');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({ where: { id: rec.userId }, data: { passwordHash, mustChangePassword: false } });
      await tx.session.updateMany({ where: { userId: rec.userId }, data: { revokedAt: new Date() } });
      await tx.passwordReset.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
      await this.audit.log(
        { actorId: rec.userId, action: 'user.reset-via-email', entity: 'User', entityId: rec.userId },
        tx,
      );
    });
    return { ok: true };
  }

  // 2FA TOTP opt-in (authenticator app). Secret disimpan, aktif setelah kode benar.
  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    return { secret, otpauthUrl: keyuri(user.nim, secret) };
  }

  async enable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecret || !verifyTotp(user.totpSecret, code))
      throw new UnauthorizedException('Kode salah');
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.audit.log({ actorId: userId, action: 'auth.2fa-enable', entity: 'User', entityId: userId }).catch(() => {});
    return { ok: true };
  }

  async disable2fa(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Password salah');
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabled: false } });
    await this.audit.log({ actorId: userId, action: 'auth.2fa-disable', entity: 'User', entityId: userId }).catch(() => {});
    return { ok: true };
  }

  async verify2fa(pendingToken: string, code: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(pendingToken);
    } catch {
      throw new UnauthorizedException('Sesi 2FA kedaluwarsa');
    }
    if (payload.purpose !== '2fa') throw new UnauthorizedException('Token tidak valid');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE' || !user.totpEnabled || !user.totpSecret)
      throw new UnauthorizedException('Unauthorized');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new UnauthorizedException('Akun terkunci sementara');
    if (!verifyTotp(user.totpSecret, code)) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, ...(failed >= Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5) ? { lockedUntil: new Date(Date.now() + Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15) * 60_1000) } : {}) },
      });
      throw new UnauthorizedException('Kode salah');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    return { ...(await this.issueTokens(user.id)), mustChangePassword: user.mustChangePassword };
  }

  private async sendMail(to: string, subject: string, text: string) {    if (!process.env.SMTP_HOST) {
      if (process.env.NODE_ENV !== 'production') console.log(`[mail:dev] to=${to} ${text}`);
      return;
    }
    const nodemailer = await import('nodemailer');
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
    });
    await t.sendMail({ from: process.env.SMTP_FROM ?? 'no-reply@jurnalistik', to, subject, text });
  }
}
