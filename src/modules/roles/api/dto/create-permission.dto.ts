import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'report:export', description: 'Unique permission code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+:[a-z0-9-*]+$/, { message: 'Permission code must follow domain:action format' })
  code!: string;

  @ApiProperty({ example: 'Allows exporting academic reports' })
  @IsString()
  @IsOptional()
  description?: string;
}