import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { AttendanceController } from './api/attendance.controller';
import { ResultsController } from './api/results.controller';
import { AttendanceService } from './application/attendance.service';
import { ResultsService } from './application/results.service';
import { TranscriptsService } from './application/transcripts.service';
import { AttendanceRecordRepository } from './infrastructure/attendance-record.repository';
import { ResultsRepository } from './infrastructure/results.repository';
import { AttendanceRecord } from './domain/attendance-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord]), RolesModule],
  controllers: [AttendanceController, ResultsController],
  providers: [
    AttendanceService,
    ResultsService,
    TranscriptsService,
    AttendanceRecordRepository,
    ResultsRepository,
  ],
  exports: [AttendanceService, ResultsService, TranscriptsService],
})
export class AttendanceModule {}