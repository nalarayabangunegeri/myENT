import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatsService } from '../attendance/attendance-stats.service';
import { badges, streaks } from './points.rules';

@Injectable()
export class InsightService {
  constructor(private prisma: PrismaService, private stats: AttendanceStatsService) {}

  async dashboard() {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [members, active, meetings, assignments, pending, att] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.meeting.count({ where: { deletedAt: null } }),
      this.prisma.assignment.count({ where: { deadline: { gte: new Date() } } }),
      this.prisma.absenceRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          submittedAt: { gte: monthStart },
          meeting: { deletedAt: null, finalizedAt: { not: null }, status: { not: 'CANCELLED' }, isDuty: false },
        },
        _count: true,
      }),
    ]);
    const c: Record<string, number> = {};
    for (const g of att) c[g.status] = Number(g._count);
    const eff = await this.stats.countEffective(c);
    const tot = eff + (c.ABSENT ?? 0);
    return {
      members, activeMembers: active, meetings, activeAssignments: assignments, pendingRequests: pending,
      monthAttendancePct: tot ? Math.round((eff / tot) * 1000) / 10 : null,
    };
  }

  async calendar(role: string, from: Date, to: Date) {    const meetings = await this.prisma.meeting.findMany({
      where: {
        deletedAt: null,
        startAt: { lte: to },
        endAt: { gte: from },
        ...(role === 'MEMBER' ? { status: { not: 'DRAFT' } } : {}),
      },
      select: { id: true, title: true, startAt: true, endAt: true, status: true },
      orderBy: { startAt: 'asc' },
      take: 500,
    });
    const assignments = await this.prisma.assignment.findMany({
      where: { deadline: { gte: from, lte: to } },
      select: { id: true, title: true, deadline: true },
      orderBy: { deadline: 'asc' },
      take: 500,
    });
    return { meetings, assignments };
  }

  // Poin keaktifan P2 (contoh PRD §22.2): hadir +10, tugas +10, alpha −5. Dihitung saat dibaca.
  async leaderboard() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, nim: true, name: true },
      orderBy: { name: 'asc' },
    });
    const ids = users.map((u) => u.id);
    const fin: any = { finalizedAt: { not: null }, status: { not: 'CANCELLED' }, deletedAt: null, isDuty: false };
    const [present, absent, subs] = await Promise.all([
      this.prisma.attendance.groupBy({ by: ['userId'], where: { userId: { in: ids }, status: 'PRESENT', meeting: fin }, _count: true }),
      this.prisma.attendance.groupBy({ by: ['userId'], where: { userId: { in: ids }, status: 'ABSENT', meeting: fin }, _count: true }),
      this.prisma.submission.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: true }),
    ]);
    const n = (rows: { userId: string; _count: any }[], id: string) =>
      Number(rows.find((r) => r.userId === id)?._count ?? 0);
    return users
      .map((u) => ({ user: u, points: n(present, u.id) * 10 + n(subs, u.id) * 10 - n(absent, u.id) * 5 }))
      .sort((a, b) => b.points - a.points);
  }

  async myPoints(userId: string) {
    const board = await this.leaderboard();
    const rank = board.findIndex((r) => r.user.id === userId) + 1;
    const rows = await this.prisma.attendance.findMany({
      where: {
        userId,
        meeting: { finalizedAt: { not: null }, status: { not: 'CANCELLED' }, deletedAt: null, isDuty: false },
      },
      select: { status: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
      take: 500,
    });
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const month = rows.filter((r) => r.submittedAt >= monthStart);
    const reviewedSubs = await this.prisma.submission.count({ where: { userId, reviewedAt: { not: null } } });
    const dutyAttended = await this.prisma.attendance.count({
      where: { userId, status: 'PRESENT', meeting: { isDuty: true, finalizedAt: { not: null }, deletedAt: null } },
    });
    const { current, longest } = streaks(rows);
    return {
      points: rank ? board[rank - 1].points : 0,
      rank: rank || null,
      streak: current,
      longestStreak: longest,
      badges: badges({
        streak: current,
        monthCounted: month.length,
        monthAbsent: month.filter((r) => r.status === 'ABSENT').length,
        reviewedSubs,
        dutyAttended,
      }),
    };
  }

  // Analitik lanjutan, dihitung saat dibaca (backlog §22.3).
  async trends(months = 6) {
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - months, 1);
    from.setUTCHours(0, 0, 0, 0);
    const where: any = {
      submittedAt: { gte: from },
      meeting: { finalizedAt: { not: null }, status: { not: 'CANCELLED' }, deletedAt: null, isDuty: false },
    };
    const CAP = 20000;
    const [total, rows] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        select: { status: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
        take: CAP,
      }),
    ]);
    const eff = new Set(await this.stats.effectiveList());
    const by = new Map<string, { total: number; effective: number }>();
    for (const r of rows) {
      const k = `${r.submittedAt.getUTCFullYear()}-${String(r.submittedAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const b = by.get(k) ?? { total: 0, effective: 0 };
      b.total++;
      if (eff.has(r.status)) b.effective++;
      by.set(k, b);
    }
    return {
      truncated: total > rows.length,
      data: [...by.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([month, b]) => ({ month, ...b, percentage: b.total ? Math.round((b.effective / b.total) * 1000) / 10 : null })),
    };
  }

  async frequentAbsentees(limit = 10) {
    const groups = await this.prisma.attendance.groupBy({
      by: ['userId'],
      where: { status: 'ABSENT', meeting: { finalizedAt: { not: null }, deletedAt: null, isDuty: false } },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: Math.min(limit, 50),
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.userId) } },
      select: { id: true, nim: true, name: true, division: true },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    return groups.map((g) => ({ user: map.get(g.userId), alphas: Number(g._count) }));
  }

  async byDivision() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, division: true },
    });
    const groups = await this.prisma.attendance.groupBy({
      by: ['userId', 'status'],
      where: {
        userId: { in: users.map((u) => u.id) },
        meeting: { finalizedAt: { not: null }, status: { not: 'CANCELLED' }, deletedAt: null, isDuty: false },
      },
      _count: true,
    });
    const eff = new Set(await this.stats.effectiveList());
    const div = new Map<string, { total: number; effective: number }>();
    const owner = new Map(users.map((u) => [u.id, u.division || '-']));
    for (const g of groups) {
      const d = owner.get(g.userId) ?? '-';
      const b = div.get(d) ?? { total: 0, effective: 0 };
      b.total += Number(g._count);
      if (eff.has(g.status)) b.effective += Number(g._count);
      div.set(d, b);
    }
    return [...div.entries()].map(([division, b]) => ({
      division,
      ...b,
      percentage: b.total ? Math.round((b.effective / b.total) * 1000) / 10 : null,
    }));
  }
}
