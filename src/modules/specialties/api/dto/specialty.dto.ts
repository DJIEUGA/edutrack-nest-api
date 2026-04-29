import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateSpecialtyDto {
  @ApiProperty({ example: 'SW-ENG' })
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9-]+$/i)
  code!: string;

  @ApiProperty({ example: 'Software Engineering' })
  @IsString()
  @Length(2, 200)
  name!: string;
}
