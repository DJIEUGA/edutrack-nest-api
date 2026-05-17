import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { UserRole, USER_ROLES } from '@common/types/role.types';

export class ChangeRoleDto {
  @ApiProperty({ description: 'The role to remove from this staff member' })
  @IsEnum(USER_ROLES)
  fromRole!: UserRole;

  @ApiProperty({ description: 'The role to assign to this staff member' })
  @IsEnum(USER_ROLES)
  toRole!: UserRole;

  @ApiPropertyOptional({ description: 'Department ID for the new role (required for hod, recommended for lecturer)' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class StaffListQuery {
  @ApiPropertyOptional({ enum: ['admin', 'director', 'hod', 'lecturer'] })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class GrantPermissionDto {
  @ApiProperty({ description: 'Permission code to grant (e.g. manage:courses)' })
  @IsString()
  @IsNotEmpty()
  permissionCode!: string;
}
