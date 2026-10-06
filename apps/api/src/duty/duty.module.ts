import { Module } from '@nestjs/common';
import { DutyController } from './duty.controller';
import { DutyService } from './duty.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [DutyController],
  providers: [DutyService],
})
export class DutyModule {}
