import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AbsenceModule } from './absence/absence.module';
import { OrgConfigModule } from './config/org-config.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MaterialsModule } from './materials/materials.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { InsightModule } from './insight/insight.module';
import { CorrectionModule } from './corrections/correction.module';
import { HealthModule } from './health/health.module';
import { DutyModule } from './duty/duty.module';
import { LoanModule } from './loans/loan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuditModule,
    AuthModule,
    UsersModule,
    MeetingsModule,
    AttendanceModule,
    AbsenceModule,
    OrgConfigModule,
    NotificationsModule,
    MaterialsModule,
    AssignmentsModule,
    InsightModule,
    CorrectionModule,
    HealthModule,
    DutyModule,
    LoanModule,
  ],
})
export class AppModule {}
