import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UserRole, USER_ROLES } from '@common/types/role.types';

export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsEnum(USER_ROLES)
  role!: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
