import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrgConfigService } from '../config/org-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RetentionService } from '../retention/retention.service';
import { LoanService } from '../loans/loan.service';
import { assertManualCancel, assertWindow, duplicateTimes } from './meeting.rules';

// 1 hari dalam ms. Ditulis eksplisit — pernah typo separator menjadi 10 hari.
export const DAY_MS = 86400_000;

export interface MeetingInput {
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  attendanceOpenAt: Date;
  attendanceCloseAt: Date;
  latitude?: number | null;
  longitude?: number | null;
  radiusM?: number | null;
  recurrence?: 'NONE' | 'WEEKLY';
  recurrenceCount?: number;
}

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private config: OrgConfigService,
    private notif: NotificationsService,
  ) {}

  async create(actorId: string, dto: MeetingInput & { status?: 'DRAFT' | 'PUBLISHED' }) {
    assertWindow(dto);
    if (dto.recurrence && !['NONE', 'WEEKLY'].includes(dto.recurrence))
      throw new BadRequestException('Recurrence hanya NONE/WEEKLY');
    if (dto.recurrence === 'WEEKLY' && !(dto.recurrenceCount! >= 2 && dto.recurrenceCount! <= 52))
      throw new BadRequestException('recurrenceCount 2–52');
    const m = await this.prisma.meeting.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        startAt: dto.startAt,
        endAt: dto.endAt,
        attendanceOpenAt: dto.attendanceOpenAt,
        attendanceCloseAt: dto.attendanceCloseAt,
        status: dto.status ?? 'DRAFT',
        createdBy: actorId,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        radiusM: dto.radiusM ?? null,
        recurrence: dto.recurrence ?? 'NONE',
        recurrenceCount: dto.recurrence === 'WEEKLY' ? dto.recurrenceCount! : 0,
      },
    });
    await this.audit.log({ actorId, action: 'meeting.create', entity: 'Meeting', entityId: m.id });
    return m;
  }

  visibleWhere(role: string, status?: string) {
    return {
      deletedAt: null,
      ...(role === 'MEMBER' ? { status: { not: 'DRAFT' } } : {}),
      ...(status ? { status: status as any } : {}),
    };
  }

  async list(role: string, page: number, limit: number, status?: string) {
    const where = this.visibleWhere(role, status);
    const [total, data] = await Promise.all([
      this.prisma.meeting.count({ where }),
      this.prisma.meeting.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { startAt: 'asc' } }),
    ]);
    return { page, limit, total, data };
  }

  async getOrThrow(id: string, role: string) {
    const m = await this.prisma.meeting.findFirst({ where: { id, deletedAt: null } });
    if (!m || (role === 'MEMBER' && m.status === 'DRAFT')) throw new NotFoundException('Meeting tidak ditemukan');
    return m;
  }

  async update(actorId: string, isAdmin: boolean, id: string, dto: Partial<MeetingInput> & { status?: 'PUBLISHED' | 'CANCELLED' }) {
    const m = await this.prisma.meeting.findFirst({ where: { id, deletedAt: null } });
    if (!m) throw new NotFoundException('Meeting tidak ditemukan');
    if (dto.status === 'CANCELLED') assertManualCancel(m.status, isAdmin);
    if (dto.status === 'PUBLISHED' && m.status !== 'DRAFT')
      throw new ForbiddenException('Hanya DRAFT yang bisa dipublikasikan');
    if (dto.status && !['PUBLISHED', 'CANCELLED'].includes(dto.status))
      throw new ForbiddenException('Perubahan status manual hanya PUBLISHED/CANCELLED');
    const times = {
      startAt: dto.startAt ?? m.startAt,
      endAt: dto.endAt ?? m.endAt,
      attendanceOpenAt: dto.attendanceOpenAt ?? m.attendanceOpenAt,
      attendanceCloseAt: dto.attendanceCloseAt ?? m.attendanceCloseAt,
    };
    const timeChanged =
      +times.startAt !== +m.startAt || +times.endAt !== +m.endAt ||
      +times.attendanceOpenAt !== +m.attendanceOpenAt || +times.attendanceCloseAt !== +m.attendanceCloseAt;
    if (timeChanged) {
      if (m.finalizedAt) throw new ForbiddenException('Window terkunci setelah finalized; gunakan penyesuaian manual (§13)');
      assertWindow(times as any);
    }
    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(timeChanged ? times : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.radiusM !== undefined ? { radiusM: dto.radiusM } : {}),
      },
    });
    await this.audit.log({
      actorId, action: 'meeting.update', entity: 'Meeting', entityId: id,
      oldValue: { status: m.status } as any, newValue: { status: updated.status } as any,
    });
    if (dto.status === 'CANCELLED')
      await this.notif.broadcast(undefined, 'meeting-cancelled', `Kegiatan dibatalkan: ${m.title}`, '').catch(() => {});
    else if (timeChanged)
      await this.notif.broadcast(undefined, 'meeting-updated', `Jadwal berubah: ${m.title}`, '').catch(() => {});
    return updated;
  }

  async duplicate(actorId: string, id: string, newStartAt: Date) {
    const src = await this.prisma.meeting.findFirst({ where: { id, deletedAt: null } });
    if (!src) throw new NotFoundException('Meeting tidak ditemukan');
    if (!(newStartAt instanceof Date) || isNaN(+newStartAt)) throw new NotFoundException('startAt baru tidak valid');
    const times = duplicateTimes(src, newStartAt);
    assertWindow(times);
    // Hasil DRAFT tanpa attendance/request tersalin (PRD §8). Lokasi + recurrence ikut;
    // duplikat memulai serinya sendiri (parentId null) agar seri asli tak terpotong.
    const m = await this.prisma.meeting.create({
      data: {
        title: src.title, description: src.description, ...times,
        status: 'DRAFT', createdBy: actorId,
        latitude: src.latitude, longitude: src.longitude, radiusM: src.radiusM,
        recurrence: src.recurrence, recurrenceCount: src.recurrenceCount,
      },
    });
    await this.audit.log({ actorId, action: 'meeting.duplicate', entity: 'Meeting', entityId: m.id, newValue: { from: id } as any });
    return m;
  }

  async remove(actorId: string, id: string) {    const m = await this.prisma.meeting.findFirst({ where: { id, deletedAt: null } });
    if (!m) throw new NotFoundException('Meeting tidak ditemukan');
    // ponytail: guard "sudah ada attendance" menyusul M2 (model belum ada). Soft delete tetap.
    const updated = await this.prisma.meeting.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ actorId, action: 'meeting.delete', entity: 'Meeting', entityId: id });
    return { ok: true, deletedAt: updated.deletedAt };
  }

  // QR P2: token segar tiap generate, kedaluwarsa 5 menit.
  async qrFor(id: string) {
    const m = await this.prisma.meeting.findFirst({ where: { id, deletedAt: null } });
    if (!m) throw new NotFoundException('Meeting tidak ditemukan');
    const exp = Date.now() + 5 * 60_1000;
    const { signQr } = await import('./qr.rules');
    const QRCode = (await import('qrcode')).default;
    const token = signQr(id, exp, process.env.JWT_SECRET ?? 'dev');
    return { qr: await QRCode.toDataURL(token), expiresAt: new Date(exp) };
  }

  // Cegah tick ganda multi-instance via advisory lock (AGENTS §12).
  async tryTickLock(): Promise<boolean> {
    const r = (await this.prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock(hashtext('meeting-tick')) AS ok`,
    ).catch(() => [{ ok: true }])) as any[];
    return !!r[0]?.ok;
  }

  async unlockTick() {
    await this.prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(hashtext('meeting-tick'))`).catch(() => {});
  }

  // Satu tick transisi otomatis; idempotent via WHERE (AGENTS §12).
  async tick(now = new Date()) {
    const r = await this.prisma.$transaction(async (tx: any) => {
      const toOngoing = await tx.meeting.updateMany({
        where: { status: 'PUBLISHED', startAt: { lte: now }, deletedAt: null },
        data: { status: 'ONGOING' },
      });
      const toCompleted = await tx.meeting.updateMany({
        where: { status: 'ONGOING', endAt: { lte: now }, deletedAt: null },
        data: { status: 'COMPLETED' },
      });
      return { toOngoing: toOngoing.count, toCompleted: toCompleted.count };
    });
    const finalized = await this.finalizeDue(now);
    await this.sendReminders(now);
    return { ...r, finalized };
  }

  // Reminder presensi dibuka / hampir ditutup (PRD §15.4); sekali per meeting via flag.
  async sendReminders(now = new Date()) {
    const open = await this.prisma.meeting.findMany({
      where: {
        status: { in: ['PUBLISHED', 'ONGOING'] }, deletedAt: null, notifOpenedSentAt: null,
        attendanceOpenAt: { lte: now }, attendanceCloseAt: { gte: now },
      },
      select: { id: true, title: true },
    });
    for (const m of open) {
      await this.notif.broadcast(undefined, 'attendance-opened', `Presensi dibuka: ${m.title}`, '').catch(() => {});
      await this.prisma.meeting.update({ where: { id: m.id }, data: { notifOpenedSentAt: now } });
    }
    const closingAt = new Date(now.getTime() + 30 * 60_1000);
    const closing = await this.prisma.meeting.findMany({
      where: {
        status: { in: ['PUBLISHED', 'ONGOING'] }, deletedAt: null, notifClosingSentAt: null,
        attendanceCloseAt: { gte: now, lte: closingAt },
      },
      select: { id: true, title: true },
    });
    for (const m of closing) {
      await this.notif.broadcast(undefined, 'attendance-closing', `Presensi hampir ditutup: ${m.title}`, '').catch(() => {});
      await this.prisma.meeting.update({ where: { id: m.id }, data: { notifClosingSentAt: now } });
    }
  }

  // Auto Alpha PRD §12: per meeting satu transaksi; idempotent via skipDuplicates + finalizedAt.
  async finalizeDue(now = new Date()) {
    const mapping = await this.config.get<Record<string, string>>('approval_mapping');
    const due = await this.prisma.meeting.findMany({
      where: {
        attendanceCloseAt: { lte: now }, finalizedAt: null, deletedAt: null,
        status: { in: ['PUBLISHED', 'ONGOING', 'COMPLETED'] },
      },
      select: { id: true, startAt: true, recurrence: true, recurrenceCount: true, recurrenceParentId: true },
    });
    let finalized = 0;
    for (const m of due) {
      await this.prisma.$transaction(async (tx: any) => {
        const eligible = await tx.user.findMany({
          where: {
            status: 'ACTIVE', joinedAt: { lte: m.startAt },
            attendances: { none: { meetingId: m.id } },
          },
          select: { id: true },
        });
        if (!eligible.length) {
          await tx.meeting.updateMany({ where: { id: m.id, finalizedAt: null }, data: { finalizedAt: now } });
          return;
        }
        const approved = await tx.absenceRequest.findMany({
          where: { meetingId: m.id, status: 'APPROVED', userId: { in: eligible.map((u: any) => u.id) } },
          select: { userId: true, reasonType: true },
        });
        const map = new Map(approved.map((r: any) => [r.userId, (mapping as Record<string, string>)[r.reasonType]]));
        await tx.attendance.createMany({
          data: eligible.map((u: any) => ({
            userId: u.id, meetingId: m.id,
            status: map.get(u.id) ?? 'ABSENT',
            source: map.has(u.id) ? 'ABSENCE_APPROVAL' : 'AUTO_ALPHA',
            submittedAt: now,
          })),
          skipDuplicates: true,
        });
        await tx.meeting.updateMany({ where: { id: m.id, finalizedAt: null }, data: { finalizedAt: now } });
      });
      await this.spawnRecurrence(m);
      finalized++;
    }
    return finalized;
  }

  // Backlog recurring (§22.3): seri WEEKLY sederhana — anak selalu DRAFT untuk direview.
  async spawnRecurrence(m: { id: string; recurrence: string; recurrenceCount: number; recurrenceParentId: string | null }) {
    if (m.recurrence !== 'WEEKLY' || m.recurrenceCount < 2) return;
    const rootId = m.recurrenceParentId ?? m.id;
    const series = await this.prisma.meeting.findMany({
      where: { OR: [{ id: rootId }, { recurrenceParentId: rootId }], deletedAt: null },
      select: { id: true, startAt: true },
      orderBy: { startAt: 'desc' },
    });
    if (series.length >= m.recurrenceCount) return;
    const src = await this.prisma.meeting.findUniqueOrThrow({ where: { id: series[0].id } });
    const next = new Date(src.startAt.getTime() + 7 * DAY_MS);
    const times = duplicateTimes(src, next);
    await this.prisma.meeting.create({
      data: {
        title: src.title, description: src.description, ...times,
        status: 'DRAFT', createdBy: src.createdBy,
        latitude: src.latitude, longitude: src.longitude, radiusM: src.radiusM,
        recurrence: 'WEEKLY', recurrenceCount: m.recurrenceCount, recurrenceParentId: rootId,
      },
    });
  }
}

// ponytail: setInterval in-process (single instance). Upgrade: advisory lock PG saat multi-instance (AGENTS §12).
@Injectable()
export class MeetingJob implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(
    private meetings: MeetingsService,
    private retention: RetentionService,
    private loans: LoanService,
  ) {}
  onModuleInit() {
    const ms = Number(process.env.MEETING_TICK_MS ?? 60_000);
    this.timer = setInterval(
      () =>
        (async () => {
          if (!(await this.meetings.tryTickLock())) return;
          try {
            await this.meetings.tick();
            await this.retention.tick();
            await this.loans.overdueTick();
          } finally {
            await this.meetings.unlockTick();
          }
        })().catch((e) => console.error('[meeting-tick]', e)),
      ms,
    );
    this.timer.unref?.();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
}
