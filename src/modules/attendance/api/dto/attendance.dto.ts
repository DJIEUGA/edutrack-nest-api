import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { AttendanceStatus } from '../../domain/attendance-record.entity';

export class MarkAttendanceDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: ['present', 'absent', 'late', 'excused'] })
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status!: AttendanceStatus;
}

export class BulkAttendanceEntryDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: ['present', 'absent', 'late', 'excused'] })
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status!: AttendanceStatus;
}

export class BulkMarkAttendanceDto {
  @ApiProperty({ type: [BulkAttendanceEntryDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  entries!: BulkAttendanceEntryDto[];
}
