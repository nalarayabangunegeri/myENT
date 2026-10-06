import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { toXlsx } from '../common/xlsx';
import { recapPdf } from '../common/recap-pdf';
import { verifyQr } from '../meetings/qr.rules';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

class AdjustDto {
  @IsUUID() userId!: string;
  @IsIn(['PRESENT', 'PERMITTED', 'SICK', 'DISPENSATION', 'ABSENT']) status!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

class SelfieBody {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
}

class QrDto extends SelfieBody {
  @IsString() @MinLength(10) token!: string;
}

class RecapQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
  @IsOptional() @IsDate() @Type(() => Date) from?: Date;
  @IsOptional() @IsDate() @Type(() => Date) to?: Date;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Post('meetings/:id/attendance')
  @UseInterceptors(FileInterceptor('selfie', { limits: { files: 1, fileSize: 5 * 1024 * 1024 } }))
  create(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SelfieBody,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Magic bytes divalidasi di service (mime client tak dipercaya — AGENTS §8).
    return this.attendance.createSelf(req.user.id, id, file?.buffer ?? Buffer.alloc(0), body);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Post('meetings/:id/attendance/qr')
  @UseInterceptors(FileInterceptor('selfie', { limits: { files: 1, fileSize: 5 * 1024 * 1024 } }))
  createQr(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: QrDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!verifyQr(body.token, id, process.env.JWT_SECRET ?? 'dev'))
      throw new BadRequestException('QR tidak valid/kedaluwarsa');
    return this.attendance.createSelf(req.user.id, id, file?.buffer ?? Buffer.alloc(0), body);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('meetings/:id/attendance/me')
  myOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.attendance.myOne(req.user.id, id);
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('meetings/:id/attendance')
  byMeeting(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query() q: PageQuery) {
    return this.attendance.listByMeeting(req.user, id, q.page ?? 1, Math.min(q.limit ?? 20, 100));
  }

  @Roles('OFFICER', 'ADMIN')
  @Post('meetings/:id/attendance/adjust')
  adjust(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustDto) {
    return this.attendance.adjust(req.user, id, dto.userId, dto.status, dto.reason);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('attendance/me')
  myList(@Req() req: any, @Query() q: PageQuery) {
    return this.attendance.myList(req.user.id, q.page ?? 1, Math.min(q.limit ?? 20, 100));
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('attendance/recap/me')
  recapMe(@Req() req: any) {
    return this.attendance.recapMe(req.user.id);
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('attendance/recap')
  recap(@Query() q: RecapQuery) {
    return this.attendance.recapAll(
      q.search, q.sortBy ?? 'name', q.order ?? 'asc', q.page ?? 1, Math.min(q.limit ?? 20, 100), q.from, q.to,
    );
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('attendance/recap/export.xlsx')
  async recapXlsx(@Query() q: RecapQuery, @Res({ passthrough: true }) res: Response) {
    const r = await this.attendance.recapAll(undefined, 'name', 'asc', 1, 5000, q.from, q.to);
    const buf = await toXlsx(
      ['Nama', 'NIM', 'Divisi', 'Hadir', 'Izin', 'Sakit', 'Dispensasi', 'Alpha', 'Persentase'],
      r.data.map((x: any) => [x.user.name, x.user.nim, x.user.division, x.present, x.permitted, x.sick, x.dispensation, x.absent, x.percentage ?? '–']),
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rekap.xlsx"');
    if (r.total > r.data.length) res.setHeader('X-Truncated', 'true');
    res.send(buf);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('attendance/recap/me.pdf')
  async recapMePdf(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const r = await this.attendance.recapMe(req.user.id);
    const buf = await recapPdf({
      name: req.user.name, nim: req.user.nim,
      counted: r.counted, present: r.present, permitted: r.permitted, sick: r.sick,
      dispensation: r.dispensation, absent: r.absent, percentage: r.percentage,
      history: r.history.map((h: any) => ({ title: h.meeting.title, status: h.status, date: h.meeting.startAt })),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rekap.pdf"');
    res.send(buf);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('attendance/:id/selfie')
  selfie(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const base = `${req.protocol}://${req.get('host')}`;
    return this.attendance.selfieUrl(req.user, id, base);
  }
}
