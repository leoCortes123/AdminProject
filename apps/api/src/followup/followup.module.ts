import { Module } from '@nestjs/common';
import { FollowupController } from './followup.controller';
import { FollowupService } from './followup.service';

@Module({
  controllers: [FollowupController],
  providers: [FollowupService],
  exports: [FollowupService],
})
export class FollowupModule {}
