import { Module } from '@nestjs/common';
import { CorrectionController } from './correction.controller';
import { CorrectionService } from './correction.service';
import { AuditModule } from '../audit/audit.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, AttendanceModule, StorageModule, NotificationsModule],
  controllers: [CorrectionController],
  providers: [CorrectionService],
})
export class CorrectionModule {}
