import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
