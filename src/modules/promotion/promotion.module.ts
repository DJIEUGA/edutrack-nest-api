import { Module } from '@nestjs/common';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { TimetableModule } from '@modules/timetable/timetable.module';
import { PromotionCycleController } from './api/promotion-cycle.controller';
import { SlotPromotionController } from './api/slot-promotion.controller';
import { PromotionReminderController } from './api/promotion-reminder.controller';
import { PromotionService } from './application/promotion.service';
import { PromotionSchedulerService } from './application/promotion-scheduler.service';
import { PromotionRepository } from './infrastructure/promotion.repository';
import { PromotionReadRepository } from './infrastructure/promotion-read.repository';

@Module({
  imports: [SessionsModule, TimetableModule],
  controllers: [
    PromotionCycleController,
    SlotPromotionController,
    PromotionReminderController,
  ],
  providers: [
    PromotionService,
    PromotionSchedulerService,
    PromotionRepository,
    PromotionReadRepository,
  ],
})
export class PromotionModule {}
