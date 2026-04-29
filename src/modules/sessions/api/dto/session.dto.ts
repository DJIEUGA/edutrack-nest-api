import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty()
  @IsUUID()
  courseAssignmentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  timetableSlotId?: string;

  @ApiProperty({ example: '2025-09-01' })
  @IsDateString()
  scheduledDate!: string;
}

export class StartSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accuracy?: number;
}
