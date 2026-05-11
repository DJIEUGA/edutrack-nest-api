import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Max, Min,
} from 'class-validator';
import { SchoolStatus } from '../../domain/school.entity';

export class UpdateSchoolDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: SchoolStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  address?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Africa/Accra' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ minimum: 5, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  sessionDurationMinutes?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  lateThresholdMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireGeoCheckin?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowLateCheckin?: boolean;
}
