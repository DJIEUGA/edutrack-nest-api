import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateTimetableSlotDto {
  @ApiProperty()
  @IsUUID()
  academicYearId!: string;

  @ApiProperty()
  @IsUUID()
  courseAssignmentId!: string;

  @ApiProperty({ description: '0=Sunday … 6=Saturday', minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @ApiProperty({ example: '09:30' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venue?: string;
}
