import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Allow, IsNotEmpty, IsString } from 'class-validator';
import { OrgConfigService } from './org-config.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class SetDto {
  @IsString() @IsNotEmpty() key!: string;
  @Allow() value!: unknown;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('config')
export class ConfigController {
  constructor(
    private config: OrgConfigService,
    private audit: AuditService,
  ) {}

  @Get()
  all() {
    return this.config.all();
  }

  @Patch()
  async set(@Req() req: any, @Body() dto: SetDto) {
    const before = await this.config.get(dto.key).catch(() => undefined);
    // Perubahan status efektif berlaku ke seluruh histori rekap (PRD §15.8) — konfirmasi di UI.
    const r = await this.config.set(dto.key, dto.value);
    await this.audit.log({
      actorId: req.user.id, action: 'config.update', entity: 'OrgConfig', entityId: dto.key,
      oldValue: before as any, newValue: dto.value as any,
    });
    return r;
  }
}
