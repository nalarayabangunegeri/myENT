import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CorrectionService } from './correction.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class CreateDto {
  @IsString() @MinLength(10) @MaxLength(1000) claim!: string;
}

class DecideDto {
  @IsString() @IsOptional() @MaxLength(500) reviewNote?: string;
}

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CorrectionController {
  constructor(private corrections: CorrectionService) {}

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Post('meetings/:id/corrections')
  @UseInterceptors(FileInterceptor('evidence', { limits: { files: 1, fileSize: 5 * 1024 * 1024 } }))
  create(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.corrections.create(req.user.id, id, dto.claim, file?.buffer);
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get('corrections/me')
  myList(@Req() req: any, @Query() q: PageQuery) {
    return this.corrections.myList(req.user.id, q.page ?? 1, Math.min(q.limit ?? 20, 100));
  }

  @Roles('OFFICER', 'ADMIN')
  @Get('meetings/:id/corrections')
  byMeeting(@Param('id', ParseUUIDPipe) id: string, @Query() q: PageQuery) {
    return this.corrections.listByMeeting(id, q.page ?? 1, Math.min(q.limit ?? 20, 100));
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Patch('corrections/:id/cancel')
  cancel(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.corrections.cancel(req.user.id, id);
  }

  @Roles('OFFICER', 'ADMIN')
  @Patch('corrections/:id/approve')
  approve(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) {
    return this.corrections.decide(req.user, id, true, dto.reviewNote ?? '');
  }

  @Roles('OFFICER', 'ADMIN')
  @Patch('corrections/:id/reject')
  reject(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) {
    return this.corrections.decide(req.user, id, false, dto.reviewNote ?? '');
  }
}
