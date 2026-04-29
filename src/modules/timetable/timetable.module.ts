import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { TimetableController } from './api/timetable.controller';
import { TimetableService } from './application/timetable.service';
import { TimetableSlot } from './domain/timetable-slot.entity';
import { TimetableSlotRepository } from './infrastructure/timetable-slot.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TimetableSlot]), RolesModule],
  controllers: [TimetableController],
  providers: [TimetableService, TimetableSlotRepository],
  exports: [TimetableService, TimetableSlotRepository],
})
export class TimetableModule {}
