
import { Module } from '@nestjs/common';
import { RolesModule } from '@modules/roles/roles.module';
import { SchoolsModule } from '@modules/schools/schools.module';
import { TimetableController } from './api/timetable.controller';
import { ClassTimetableController } from './api/class-timetable.controller';
import { TimetableService } from './application/timetable.service';
import { TimetablePublicService } from './application/timetable-public.service';
import { ClassTimetableService } from './application/class-timetable.service';
import { TimetableRepository } from './infrastructure/timetable.repository';
import { ClassTimetableRepository } from './infrastructure/class-timetable.repository';

@Module({
  imports: [SchoolsModule, RolesModule],
  controllers: [TimetableController, ClassTimetableController],
  providers: [
    TimetableService,
    TimetablePublicService,
    TimetableRepository,
    ClassTimetableService,
    ClassTimetableRepository,
  ],
  exports: [
    TimetableService,
    TimetablePublicService,
    TimetableRepository,
    ClassTimetableService,
    ClassTimetableRepository,
  ],
})
export class TimetableModule {}
