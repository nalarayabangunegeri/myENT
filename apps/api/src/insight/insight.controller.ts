import { BadRequestException, Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';
import { InsightService } from './insight.service';
import { toIcs } from './ics';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class RangeQuery {
  @IsOptional() @IsDate() @Type(() => Date) from?: Date;
  @IsOptional() @IsDate() @Type(() => Date) to?: Date;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class InsightController {
  constructor(private insight: InsightService) {}

  @Roles('OFFICER', 'ADMIN')
  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.insight.dashboard(req.user);
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('points/leaderboard')
  leaderboard(@Req() req: any) {
    return this.insight.leaderboard(req.user);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('points/me')
  myPoints(@Req() req: any) {
    return this.insight.myPoints(req.user.id, req.user);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('calendar')
  calendar(@Req() req: any, @Query() q: RangeQuery) {
    const to = q.to ?? new Date(Date.now() + 30 * 86400_000);
    const from = q.from ?? new Date();
    if (from > to) throw new BadRequestException('Rentang tidak valid');
    return this.insight.calendar(req.user.role, from, to);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('calendar.ics')
  async ics(@Req() req: any, @Query() q: RangeQuery, @Res({ passthrough: true }) res: Response) {
    const to = q.to ?? new Date(Date.now() + 30 * 86400_000);
    const from = q.from ?? new Date();
    const cal = await this.insight.calendar(req.user.role, from, to);
    const ics = toIcs([
      ...cal.meetings.map((m: any) => ({ id: m.id, title: m.title, start: m.startAt, end: m.endAt })),
      ...cal.assignments.map((a: any) => ({ id: a.id, title: `Deadline: ${a.title}`, start: a.deadline, end: a.deadline })),
    ]);
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="kalender.ics"');
    res.send(ics);
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('analytics/trends')
  trends(@Req() req: any, @Query('months') months?: string) {
    const n = Number(months ?? 6);
    const m = Math.min(Math.max(Number.isFinite(n) ? n : 6, 1), 24);
    return this.insight.trends(m, req.user);
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('analytics/frequent-absentees')
  absentees(@Req() req: any, @Query('limit') limit?: string) {
    const n = Number(limit ?? 10);
    return this.insight.frequentAbsentees(Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 10, 1), 50), req.user);
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('analytics/by-division')
  byDivision(@Req() req: any) {
    return this.insight.byDivision(req.user);
  }
}
