import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class MeetingDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @IsOptional() @MaxLength(2000) description?: string;
  @IsDate() @Type(() => Date) startAt!: Date;
  @IsDate() @Type(() => Date) endAt!: Date;
  @IsDate() @Type(() => Date) attendanceOpenAt!: Date;
  @IsDate() @Type(() => Date) attendanceCloseAt!: Date;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED']) status?: 'DRAFT' | 'PUBLISHED';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(5000) radiusM?: number;
  @IsOptional() @IsIn(['NONE', 'WEEKLY']) recurrence?: 'NONE' | 'WEEKLY';
  @IsOptional() @Type(() => Number) @IsInt() @Min(2) @Max(52) recurrenceCount?: number;
}

class UpdateMeetingDto {
  @IsString() @IsOptional() @MinLength(3) @MaxLength(200) title?: string;
  @IsString() @IsOptional() @MaxLength(2000) description?: string;
  @IsDate() @IsOptional() @Type(() => Date) startAt?: Date;
  @IsDate() @IsOptional() @Type(() => Date) endAt?: Date;
  @IsDate() @IsOptional() @Type(() => Date) attendanceOpenAt?: Date;
  @IsDate() @IsOptional() @Type(() => Date) attendanceCloseAt?: Date;
  @IsOptional() @IsIn(['PUBLISHED', 'CANCELLED']) status?: 'PUBLISHED' | 'CANCELLED';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(5000) radiusM?: number | null;
}

class DuplicateDto {
  @IsDate() @Type(() => Date) startAt!: Date;
}

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED']) status?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private meetings: MeetingsService) {}

  @Roles('OFFICER', 'ADMIN')
  @Post()
  create(@Req() req: any, @Body() dto: MeetingDto) {
    return this.meetings.create(req.user.id, dto);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get()
  list(@Req() req: any, @Query() q: ListQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);
    return this.meetings.list(req.user.role, page, limit, q.status);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get(':id')
  get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.getOrThrow(id, req.user.role);
  }

  @Roles('OFFICER', 'ADMIN')
  @Patch(':id')
  update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeetingDto) {
    return this.meetings.update(req.user.id, req.user.role === 'ADMIN', id, dto);
  }

  @Roles('OFFICER', 'ADMIN')
  @Post(':id/duplicate')
  duplicate(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DuplicateDto) {
    return this.meetings.duplicate(req.user.id, id, dto.startAt);
  }

  @Roles('OFFICER', 'ADMIN')
  @Get(':id/qr')
  qr(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.qrFor(id);
  }

  @Roles('OFFICER', 'ADMIN')
  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.remove(req.user.id, id);
  }
}
