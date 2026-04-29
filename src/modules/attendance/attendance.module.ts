import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { AttendanceController } from './api/attendance.controller';
import { AttendanceService } from './application/attendance.service';
import { AttendanceRecord } from './domain/attendance-record.entity';
import { AttendanceRecordRepository } from './infrastructure/attendance-record.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord]), RolesModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRecordRepository],
  exports: [AttendanceService, AttendanceRecordRepository],
})
export class AttendanceModule {}
