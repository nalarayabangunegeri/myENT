import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// Piket = meeting khusus (reuse presensi); roster giliran otomatis, anak selalu DRAFT.
@Injectable()
export class DutyService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private at(date: Date, hm: string) {
    const [h, m] = hm.split(':').map(Number);
    const d = new Date(date);
    d.setUTCHours(h, m ?? 0, 0, 0);
    return d;
  }

  async generate(
    actorId: string,
    dto: { startDate: Date; days: number; perDay?: number; division?: string; openTime?: string; closeTime?: string; titlePrefix?: string },
  ) {
    if (!(dto.startDate instanceof Date) || isNaN(+dto.startDate)) throw new BadRequestException('startDate tidak valid');
    if (!(dto.days >= 1 && dto.days <= 90)) throw new BadRequestException('days 1–90');
    const perDay = dto.perDay ?? 1;
    if (!(perDay >= 1 && perDay <= 5)) throw new BadRequestException('perDay 1–5');
    const members = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', ...(dto.division ? { division: dto.division } : {}) },
      select: { id: true },
      orderBy: { nim: 'asc' },
    });
    if (!members.length) throw new BadRequestException('Tidak ada anggota aktif');
    const open = dto.openTime ?? '06:00';
    const close = dto.closeTime ?? '22:00';
    // Satu transaksi: meeting + assignment + audit atomic; assignment via createMany (bukan N insert).
    const made = await this.prisma.$transaction(async (tx: any) => {
      let n = 0;
      const assigns: { meetingId: string; userId: string }[] = [];
      for (let d = 0; d < dto.days; d++) {
        const day = new Date(dto.startDate.getTime() + d * 86400_000);
        const m = await tx.meeting.create({
          data: {
            title: `${dto.titlePrefix ?? 'Piket'} ${day.toISOString().slice(0, 10)}`,
            startAt: this.at(day, open),
            endAt: this.at(day, close),
            attendanceOpenAt: this.at(day, open),
            attendanceCloseAt: this.at(day, close),
            status: 'DRAFT',
            isDuty: true,
            createdBy: actorId,
          },
        });
        for (let k = 0; k < perDay; k++) {
          const u = members[(d * perDay + k) % members.length];
          assigns.push({ meetingId: m.id, userId: u.id });
        }
        n++;
      }
      if (assigns.length) await tx.dutyAssignment.createMany({ data: assigns, skipDuplicates: true });
      await this.audit.log({
        actorId, action: 'duty.roster', entity: 'Meeting', entityId: `${dto.days} hari`,
        newValue: { days: dto.days, perDay, division: dto.division ?? null } as any,
      }, tx);
      return n;
    }, { timeout: 30_000 });
    return { meetings: made };
  }

  async myAssignments(userId: string) {
    return this.prisma.dutyAssignment.findMany({
      where: { userId, meeting: { deletedAt: null } },
      include: { meeting: { select: { id: true, title: true, startAt: true, endAt: true, status: true } } },
      orderBy: { meeting: { startAt: 'asc' } },
    });
  }

  async assignmentsByMeeting(meetingId: string) {
    return this.prisma.dutyAssignment.findMany({
      where: { meetingId },
      include: { user: { select: { id: true, nim: true, name: true } } },
    });
  }

  async summary(userId: string) {
    const sched = await this.prisma.dutyAssignment.findMany({
      where: { userId, meeting: { deletedAt: null, finalizedAt: { not: null }, status: { not: 'CANCELLED' } } },
      select: { meetingId: true },
    });
    if (!sched.length) return { scheduled: 0, attended: 0 };
    const attended = await this.prisma.attendance.count({
      where: { userId, meetingId: { in: sched.map((s) => s.meetingId) }, status: 'PRESENT' },
    });
    return { scheduled: sched.length, attended };
  }
}
