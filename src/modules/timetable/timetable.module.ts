
import { Module } from '@nestjs/common';
import { RolesModule } from '@modules/roles/roles.module';
import { SchoolsModule } from '@modules/schools/schools.module';
import { TimetableController } from './api/timetable.controller';
import { TimetableService } from './application/timetable.service';
import { TimetableRepository } from './infrastructure/timetable.repository';

@Module({
  imports: [SchoolsModule, RolesModule],
  controllers: [TimetableController],
  providers: [
    TimetableService,
    TimetableRepository,
  ],
  exports: [
    TimetableService,
    TimetableRepository,
  ],
})
export class TimetableModule {}