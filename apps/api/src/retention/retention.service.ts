import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { OrgConfigService } from '../config/org-config.service';

// Retensi file privat BR-20/PRD §17: hapus OBJEK dulu, baru isi *_deleted_at; record tetap.
// Idempotent: hanya yang *_deleted_at NULL + lewat batas. Configurable via env (default 12/6 bulan).
@Injectable()
export class RetentionService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: OrgConfigService,
  ) {}

  private months(n: number, now: Date) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d;
  }

  async tick(now = new Date()) {
    const sMonths = await this.config.get<number>('retention_selfie_months');
    const aMonths = await this.config.get<number>('retention_attachment_months');
    const subMonths = await this.config.get<number>('retention_submission_months');
    const notifDays = await this.config.get<number>('retention_notif_days');
    let selfies = 0;
    let attachments = 0;
    for (;;) {
      const old = await this.prisma.attendance.findMany({
        where: { selfieObjectKey: { not: null }, selfieDeletedAt: null, submittedAt: { lte: this.months(sMonths, now) } },
        select: { id: true, selfieObjectKey: true },
        take: 100,
      });
      if (!old.length) break;
      for (const a of old) {
        await this.storage.remove(a.selfieObjectKey!);
        await this.prisma.attendance.update({
          where: { id: a.id },
          data: { selfieObjectKey: null, selfieDeletedAt: now },
        });
        selfies++;
      }
    }
    for (;;) {
      const old = await this.prisma.absenceRequest.findMany({        where: {
          attachmentObjectKey: { not: null }, attachmentDeletedAt: null,
          reviewedAt: { not: null, lte: this.months(aMonths, now) },
        },
        select: { id: true, attachmentObjectKey: true },
        take: 100,
      });
      if (!old.length) break;
      for (const r of old) {
        await this.storage.remove(r.attachmentObjectKey!);
        await this.prisma.absenceRequest.update({
          where: { id: r.id },
          data: { attachmentObjectKey: null, attachmentDeletedAt: now },
        });
        attachments++;
      }
    }
    let submissions = 0;    for (;;) {
      const old = await this.prisma.submission.findMany({
        where: { fileDeletedAt: null, submittedAt: { lte: this.months(subMonths, now) } },
        select: { id: true, objectKey: true },
        take: 100,
      });
      if (!old.length) break;
      for (const s of old) {
        await this.storage.remove(s.objectKey);
        await this.prisma.submission.update({ where: { id: s.id }, data: { fileDeletedAt: now } });
        submissions++;
      }
    }
    // Riwayat notifikasi dihapus permanen (record boleh hilang — PRD §17).
    const cutoff = new Date(now.getTime() - notifDays * 86400_000);
    const notifs = await this.prisma.notification.deleteMany({ where: { createdAt: { lte: cutoff } } });
    // Sesi basi + token reset terpakai/kedaluwarsa (anti-bloat tabel auth).
    const sessCut = new Date(now.getTime() - 30 * 86400_000);
    const sessions = await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { lte: sessCut } }] },
    });
    const resets = await this.prisma.passwordReset.deleteMany({
      where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lte: now } }] },
    });
    // Foto pinjaman: hapus objek setelah kembali + masa retensi; record tetap.
    let loanPhotos = 0;
    for (;;) {
      const old = await this.prisma.loan.findMany({
        where: {
          photoDeletedAt: null,
          photoOutKey: { not: null },
          OR: [
            { returnedAt: { lte: this.months(aMonths, now) } },
            { status: 'CANCELLED', createdAt: { lte: this.months(aMonths, now) } },
          ],
        },
        select: { id: true, photoOutKey: true, photoInKey: true },
        take: 100,
      });
      if (!old.length) break;
      for (const l of old) {
        if (l.photoOutKey) await this.storage.remove(l.photoOutKey);
        if (l.photoInKey) await this.storage.remove(l.photoInKey);
        await this.prisma.loan.update({ where: { id: l.id }, data: { photoOutKey: null, photoInKey: null, photoDeletedAt: now } });
        loanPhotos++;
      }
    }
    return { selfies, attachments, submissions, notifications: notifs.count, sessions: sessions.count, resets: resets.count, loanPhotos };
  }
}
