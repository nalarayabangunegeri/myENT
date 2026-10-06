import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class CreateDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @IsOptional() @MaxLength(2000) description?: string;
  @IsUUID() @IsOptional() meetingId?: string;
}

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private materials: MaterialsService) {}

  @Roles('OFFICER', 'ADMIN')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: 20 * 1024 * 1024 } }))
  create(@Req() req: any, @Body() dto: CreateDto, @UploadedFile() file?: Express.Multer.File) {
    return this.materials.create(req.user.id, dto.title, dto.description ?? '', dto.meetingId, file?.buffer ?? Buffer.alloc(0));
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get()
  list(@Query() q: PageQuery) {
    return this.materials.list(q.page ?? 1, Math.min(q.limit ?? 20, 100));
  }

  @Roles('MEMBER', 'OFFICER', 'ADMIN')
  @Get(':id/file')
  file(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const base = `${req.protocol}://${req.get('host')}`;
    return this.materials.fileUrl(req.user, id, base);
  }

  @Roles('OFFICER', 'ADMIN')
  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.materials.remove(req.user.id, req.user.role === 'ADMIN', id);
  }
}
