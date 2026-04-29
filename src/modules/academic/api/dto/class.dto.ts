import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateClassDto {
  @ApiProperty()
  @IsUUID()
  academicYearId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;
}
