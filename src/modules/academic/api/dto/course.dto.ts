import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9-]+$/i)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiPropertyOptional({ minimum: 1, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  unitLoad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
