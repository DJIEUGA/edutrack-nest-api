import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ description: 'Unique slug-style code', minLength: 2, maxLength: 64 })
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9][a-z0-9-_]*$/, {
    message: 'code must be lower-case alphanumeric, with hyphens or underscores',
  })
  code!: string;

  @ApiPropertyOptional({ format: 'uri' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;
}
