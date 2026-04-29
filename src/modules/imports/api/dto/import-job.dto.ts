import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateImportJobDto {
  @ApiProperty({ description: 'Import type, e.g. "students", "timetable"' })
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  sourceFileUrl?: string;
}
