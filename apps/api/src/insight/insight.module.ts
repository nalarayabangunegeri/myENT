import { Module } from '@nestjs/common';
import { InsightController } from './insight.controller';
import { InsightService } from './insight.service';

@Module({ controllers: [InsightController], providers: [InsightService] })
export class InsightModule {}
