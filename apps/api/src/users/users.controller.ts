import { Body, Controller, Get, Patch, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, ArrayMinSize, ArrayMaxSize, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { parseMemberCsv } from '../common/csv';
import { canManageMember } from '../common/policy';

class CreateUserDto {
  @IsString() @MinLength(3) @MaxLength(32) nim!: string;
  @IsString() @MinLength(3) @MaxLength(100) name!: string;
  @IsString() @MinLength(10) @MaxLength(128) password!: string;
  @IsString() @IsOptional() role?: 'MEMBER' | 'OFFICER' | 'ADMIN';
  @IsString() @IsOptional() division?: string;
  @IsInt() @IsOptional() @Type(() => Number) cohortYear?: number;
}

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
}

class UpdateUserDto {
  @IsString() @IsOptional() @MinLength(3) @MaxLength(100) name?: string;
  @IsString() @IsOptional() @MaxLength(50) division?: string;
  @IsInt() @IsOptional() @Type(() => Number) cohortYear?: number;
  @IsEmail() @IsOptional() email?: string;
  @IsIn(['MEMBER', 'OFFICER', 'ADMIN']) @IsOptional() role?: 'MEMBER' | 'OFFICER' | 'ADMIN';
  @IsIn(['ACTIVE', 'INACTIVE']) @IsOptional() status?: 'ACTIVE' | 'INACTIVE';
}

class ImportDto {
  @IsString() @MaxLength(200_000) csv!: string;
}

class BulkDeactivateDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('4', { each: true }) ids!: string[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OFFICER', 'ADMIN')
@Controller('users')
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateUserDto) {
    if (dto.role === 'ADMIN' && req.user.role !== 'ADMIN') {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('Hanya ADMIN dapat membuat ADMIN');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nim: dto.nim,
        name: dto.name,
        passwordHash,
        role: (dto.role as any) ?? 'MEMBER',
        division: dto.division ?? '',
        cohortYear: dto.cohortYear ?? 0,
      },
    });
    await this.audit.log({
      actorId: req.user.id,
      action: 'user.create',
      entity: 'User',
      entityId: user.id,
      newValue: { nim: user.nim, role: user.role } as any,
    });
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  @Get()
  async list(@Query() q: ListQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);
    const where: any = q.search
      ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { nim: { contains: q.search, mode: 'insensitive' } }] }
      : {};
    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, nim: true, name: true, role: true, status: true, division: true, cohortYear: true, joinedAt: true },
      }),
    ]);
    return { page, limit, total, data };
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('User tidak ditemukan');
    }
    if (req.user.id !== target.id && !canManageMember(req.user, target)) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('Di luar divisi Anda');
    }
    if ((dto.role === 'ADMIN' || target.role === 'ADMIN') && req.user.role !== 'ADMIN') {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('Hanya ADMIN dapat mengubah role ADMIN');
    }
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.division !== undefined) data.division = dto.division;
    if (dto.cohortYear !== undefined) data.cohortYear = dto.cohortYear;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    // Keluar → INACTIVE + cabut sesi (PRD §7); bukan hapus. Aktif lagi → leftAt dikosongkan.
    if (dto.status !== undefined && dto.status !== target.status) {
      data.status = dto.status;
      data.leftAt = dto.status === 'INACTIVE' ? new Date() : null;
    }
    const updated = await this.prisma.$transaction(async (tx: any) => {
      const u = await tx.user.update({ where: { id }, data });
      if (data.status === 'INACTIVE') await tx.session.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
      await this.audit.log(
        {
          actorId: req.user.id, action: 'user.update', entity: 'User', entityId: id,
          oldValue: { role: target.role, status: target.status } as any,
          newValue: { role: u.role, status: u.status } as any,
        },
        tx,
      );
      return u;
    });
    const { passwordHash: _, ...safe } = updated;
    return safe;
  }

  // Import CSV via JSON body (tanpa multipart — ponytail: cukup untuk M1).
  // Hasil per baris; maks 100 baris (konvensi bulk PRD §15.7).
  @Post('import')
  async import(@Req() req: any, @Body() dto: ImportDto) {
    const { rows, errors } = parseMemberCsv(dto.csv);
    if (rows.length > 100) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException('Maksimal 100 baris per import');
    }
    const results: { nim: string; status: 'ok' | 'failed'; reason?: string; temporaryPassword?: string }[] =
      errors.map((e) => ({ nim: `baris ${e.line}`, status: 'failed' as const, reason: e.reason }));
    for (const r of rows) {
      try {
        const temp = randomBytes(9).toString('base64url');
        await this.prisma.user.create({
          data: {
            nim: r.nim, name: r.name, division: r.division, cohortYear: r.cohortYear, email: r.email ?? null,
            passwordHash: await bcrypt.hash(temp, 10), role: 'MEMBER', mustChangePassword: true,
          },
        });
        await this.audit.log({ actorId: req.user.id, action: 'user.create', entity: 'User', entityId: r.nim, newValue: { via: 'csv' } as any });
        results.push({ nim: r.nim, status: 'ok', temporaryPassword: temp });
      } catch {
        results.push({ nim: r.nim, status: 'failed', reason: 'NIM duplikat atau tidak valid' });
      }
    }
    return { total: results.length, results };
  }

  @Post('bulk-deactivate')
  async bulkDeactivate(@Req() req: any, @Body() dto: BulkDeactivateDto) {
    const results = [];
    for (const id of dto.ids) {
      try {
        await this.update(req, id, { status: 'INACTIVE' });
        results.push({ id, status: 'ok' });
      } catch (e: any) {
        results.push({ id, status: 'failed', reason: e?.message ?? 'Gagal' });
      }
    }
    return { total: results.length, results };
  }
}
