import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { toXlsx } from '../common/xlsx';

class AuditQuery {
  @IsOptional() @IsString() actor?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OFFICER', 'ADMIN')
@Controller('audit-logs')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query() q: AuditQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);
    const badDate = (s?: string) => s !== undefined && isNaN(Date.parse(s));
    if (badDate(q.from) || badDate(q.to)) throw new BadRequestException('Tanggal tidak valid');
    const where: any = {};
    if (q.actor) where.actorId = q.actor;
    if (q.action) where.action = q.action;
    if (q.entity) where.entity = q.entity;
    if (q.from || q.to)
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, nim: true, name: true } } },
      }),
    ]);
    return { page, limit, total, data };
  }

  @Get('export.xlsx')
  @Roles('ADMIN')
  async export(@Query() q: AuditQuery, @Res({ passthrough: true }) res: Response) {
    if ((q.from && isNaN(Date.parse(q.from))) || (q.to && isNaN(Date.parse(q.to)))) throw new BadRequestException('Tanggal tidak valid');
    const where: any = {};
    if (q.actor) where.actorId = q.actor;
    if (q.action) where.action = q.action;
    if (q.entity) where.entity = q.entity;
    if (q.from || q.to)
      where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, take: 5000, orderBy: { createdAt: 'desc' } }),
    ]);
    const buf = await toXlsx(
      ['Waktu', 'Aktor', 'Aksi', 'Entity', 'Entity ID', 'Alasan'],
      data.map((a) => [a.createdAt.toISOString(), a.actorId ?? '', a.action, a.entity, a.entityId, a.reason ?? '']),
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.xlsx"');
    if (total > data.length) res.setHeader('X-Truncated', 'true');
    res.send(buf);
  }
}
