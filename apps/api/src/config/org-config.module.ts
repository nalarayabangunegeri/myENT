import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConfigController } from './config.controller';
import { OrgConfigService } from './org-config.service';

@Global()
@Module({ imports: [AuditModule], controllers: [ConfigController], providers: [OrgConfigService], exports: [OrgConfigService] })
export class OrgConfigModule {}
