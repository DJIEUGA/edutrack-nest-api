import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateProgramLevelDto {
  @ApiProperty({ minimum: 1, example: 1, description: 'Study year (1 = first year)' })
  @IsInt()
  @Min(1)
  level!: number;

  @ApiProperty({ example: 'Level 1 — First Year' })
  @IsString()
  @Length(1, 100)
  name!: string;
}
