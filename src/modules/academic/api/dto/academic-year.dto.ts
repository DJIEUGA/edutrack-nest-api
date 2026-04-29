import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty()
  @IsString()
  @Length(2, 64)
  name!: string;

  @ApiProperty({ format: 'date', description: 'YYYY-MM-DD' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAcademicYearDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 64)
  name?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
