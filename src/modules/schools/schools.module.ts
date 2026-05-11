import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { School } from './domain/school.entity';
import { SchoolMembership } from './domain/school-membership.entity';
import { SchoolLookupController } from './api/school-lookup.controller';
import { SchoolsController } from './api/schools.controller';
import { VenuesController } from './api/venues.controller';
import { SchoolsService } from './application/schools.service';
import { VenuesService } from './application/venues.service';
import { SchoolRepository } from './infrastructure/school.repository';
import { VenuesRepository } from './infrastructure/venues.repository';

@Module({
  imports: [TypeOrmModule.forFeature([School, SchoolMembership]), RolesModule],
  controllers: [SchoolsController, SchoolLookupController, VenuesController],
  providers: [
    SchoolsService,
    SchoolRepository,
    VenuesService,
    VenuesRepository,
  ],
  exports: [SchoolsService, SchoolRepository, VenuesService, VenuesRepository],
})
export class SchoolsModule {}