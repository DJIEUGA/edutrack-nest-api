import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ModifySlotLevelDto {
  @ApiPropertyOptional({ description: 'New start time (HH:MM)', example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  startTime?: string;

  @ApiPropertyOptional({ description: 'New end time (HH:MM)', example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:MM format' })
  endTime?: string;

  @ApiPropertyOptional({ description: 'Venue ID (null to clear)', example: 'uuid-of-venue' })
  @IsOptional()
  @IsString()
  venue?: string | null;
}
