import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { ProgramLevelsController } from './api/program-levels.controller';
import { SpecialtiesController } from './api/specialties.controller';
import { ProgramLevelsService } from './application/program-levels.service';
import { SpecialtiesService } from './application/specialties.service';
import { ProgramLevel } from './domain/program-level.entity';
import { Specialty } from './domain/specialty.entity';
import { ProgramLevelRepository } from './infrastructure/program-level.repository';
import { SpecialtyRepository } from './infrastructure/specialty.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Specialty, ProgramLevel]), RolesModule],
  controllers: [SpecialtiesController, ProgramLevelsController],
  providers: [SpecialtiesService, ProgramLevelsService, SpecialtyRepository, ProgramLevelRepository],
  exports: [SpecialtiesService, ProgramLevelsService],
})
export class SpecialtiesModule {}
