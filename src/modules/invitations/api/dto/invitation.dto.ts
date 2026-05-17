import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole, USER_ROLES } from '@common/types/role.types';

export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsEnum(USER_ROLES)
  role!: UserRole;

  @ApiPropertyOptional({ description: 'Primary department (required when role is hod or lecturer)' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'All departments the invitation is scoped to (HoD use-case). Defaults to [departmentId].',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  departmentIds?: string[];
}

export class CompleteRegistrationDto {
  @ApiProperty({ description: 'Full name of the new staff member' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ description: 'Password to set for the new account (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password!: string;
}
