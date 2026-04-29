import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
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
}
