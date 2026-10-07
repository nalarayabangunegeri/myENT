import { Module } from '@nestjs/common';
import { InsightController } from './insight.controller';
import { InsightService } from './insight.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({ imports: [AttendanceModule], controllers: [InsightController], providers: [InsightService] })
export class InsightModule {}
