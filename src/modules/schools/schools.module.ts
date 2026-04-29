import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { SchoolsController } from './api/schools.controller';
import { SchoolsService } from './application/schools.service';
import { School } from './domain/school.entity';
import { SchoolMembership } from './domain/school-membership.entity';
import { SchoolRepository } from './infrastructure/school.repository';

@Module({
  imports: [TypeOrmModule.forFeature([School, SchoolMembership]), RolesModule],
  controllers: [SchoolsController],
  providers: [SchoolsService, SchoolRepository],
  exports: [SchoolsService, SchoolRepository],
})
export class SchoolsModule {}
