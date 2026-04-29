import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { ImportsController } from './api/imports.controller';
import { ImportsService } from './application/imports.service';
import { ImportJob } from './domain/import-job.entity';
import { ImportJobRepository } from './infrastructure/import-job.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ImportJob]), RolesModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportJobRepository],
  exports: [ImportsService],
})
export class ImportsModule {}
