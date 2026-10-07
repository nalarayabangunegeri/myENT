import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceStatsService } from './attendance-stats.service';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StorageModule, AuditModule, NotificationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceStatsService],
  exports: [AttendanceService, AttendanceStatsService],
})
export class AttendanceModule {}
