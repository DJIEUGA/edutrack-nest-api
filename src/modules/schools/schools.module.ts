import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { School } from './domain/school.entity';
import { SchoolMembership } from './domain/school-membership.entity';
import { Venue } from './domain/venue.entity';
import { SchoolLookupController } from './api/school-lookup.controller';
import { SchoolsController } from './api/schools.controller';
import { VenuesController } from './api/venues.controller';
import { ScheduleConfigController } from './api/schedule-config.controller';
import { SchoolsService } from './application/schools.service';
import { VenuesService } from './application/venues.service';
import { ScheduleConfigService } from './application/schedule-config.service';
import { SchoolRepository } from './infrastructure/school.repository';
import { VenuesRepository } from './infrastructure/venues.repository';
import { ScheduleConfigRepository } from './infrastructure/schedule-config.repository';

@Module({
  imports: [TypeOrmModule.forFeature([School, SchoolMembership, Venue]), RolesModule],
  controllers: [SchoolsController, SchoolLookupController, VenuesController, ScheduleConfigController],
  providers: [
    SchoolsService,
    SchoolRepository,
    VenuesService,
    VenuesRepository,
    ScheduleConfigService,
    ScheduleConfigRepository,
  ],
  exports: [SchoolsService, SchoolRepository, VenuesService, VenuesRepository, ScheduleConfigService, ScheduleConfigRepository],
})
export class SchoolsModule {}