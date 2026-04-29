import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateSemesterDto {
  @ApiProperty()
  @IsUUID()
  academicYearId!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 64)
  name!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
