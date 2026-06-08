import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class RescheduleSessionDto {
  @ApiProperty({ description: 'New scheduled date (YYYY-MM-DD)', example: '2026-06-25' })
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'newDate must be in YYYY-MM-DD format' })
  newDate!: string;
}
