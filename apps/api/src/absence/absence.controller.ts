import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { AbsenceService } from './absence.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class CreateDto {
  @IsIn(['SICK', 'ACADEMIC', 'BEREAVEMENT', 'ORGANIZATION', 'DISPENSATION', 'OTHER']) reasonType!: string;
  @IsString() @IsOptional() @MaxLength(1000) reasonDetail?: string;
}

class DecideDto {
  @IsString() @IsOptional() @MaxLength(500) reviewNote?: string;
}

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']) status?: string;
}

class BulkDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('4', { each: true }) ids!: string[];
  @IsIn(['approve', 'reject']) action!: 'approve' | 'reject';
  @IsString() @IsOptional() @MaxLength(500) reviewNote?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AbsenceController {
  constructor(private absence: AbsenceService) {}

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Post('meetings/:id/absence-requests')
  @UseInterceptors(FileInterceptor('attachment', { limits: { files: 1, fileSize: 5 * 1024 * 1024 } }))
  create(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.absence.create(req.user.id, id, body.reasonType, body.reasonDetail ?? '', file?.buffer);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('absence-requests/me')
  myList(@Req() req: any, @Query() q: PageQuery) {
    return this.absence.myList(req.user.id, q.page ?? 1, Math.min(q.limit ?? 20, 100));
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('meetings/:id/absence-requests')
  byMeeting(@Param('id', ParseUUIDPipe) id: string, @Query() q: PageQuery) {
    return this.absence.listByMeeting(id, q.page ?? 1, Math.min(q.limit ?? 20, 100), q.status);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Patch('absence-requests/:id/cancel')
  cancel(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.absence.cancel(req.user.id, id);
  }

  @Roles('OFFICER', 'ADMIN')
  @Patch('absence-requests/:id/approve')
  approve(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecideDto) {
    return this.absence.decide(req.user, id, true, body.reviewNote ?? '');
  }

  @Roles('OFFICER', 'ADMIN')
  @Patch('absence-requests/:id/reject')
  reject(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecideDto) {
    return this.absence.decide(req.user.id, id, false, body.reviewNote ?? '');
  }

  // Bulk per item: transaksi + audit sendiri; satu gagal tak menggagalkan lain (PRD §15.7).
  @Roles('OFFICER', 'ADMIN')
  @Post('absence-requests/bulk')
  async bulk(@Req() req: any, @Body() dto: BulkDto) {
    const results = [];
    for (const id of dto.ids) {
      try {
        await this.absence.decide(req.user, id, dto.action === 'approve', dto.reviewNote ?? '');
        results.push({ id, status: 'ok' });
      } catch (e: any) {
        results.push({ id, status: 'failed', reason: e?.message ?? 'Gagal' });
      }
    }
    return { total: results.length, results };
  }
}
