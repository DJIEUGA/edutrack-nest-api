import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9-]+$/i)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 200)
  name!: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9-]+$/i)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;
}
