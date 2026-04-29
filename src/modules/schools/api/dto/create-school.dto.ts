import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateSchoolDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ description: 'Unique within organization', minLength: 2, maxLength: 64 })
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9][a-z0-9-_]*$/, {
    message: 'code must be lower-case alphanumeric, with hyphens or underscores',
  })
  code!: string;
}
