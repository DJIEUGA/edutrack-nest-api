import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class CreatePromotionCycleDto {
  @ApiPropertyOptional({
    description: 'Start date of the week to promote (Monday, YYYY-MM-DD). Defaults to next Monday in school timezone.',
    example: '2026-06-23',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'weekStart must be in YYYY-MM-DD format' })
  weekStart?: string;
}
