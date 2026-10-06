import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingJob, MeetingsService } from './meetings.service';
import { AuditModule } from '../audit/audit.module';
import { RetentionModule } from '../retention/retention.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoanModule } from '../loans/loan.module';

@Module({
  imports: [AuditModule, RetentionModule, NotificationsModule, LoanModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingJob],
})
export class MeetingsModule {}
