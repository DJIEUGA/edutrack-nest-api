import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '@common/types/role.types';

export class AssignRoleDto {
  @ApiProperty({ example: 'u-uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: ['owner', 'admin', 'lecturer', 'student', 'follower'] })
  @IsEnum(['owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian', 'follower'])
  role!: UserRole;

  @ApiProperty({ description: 'Optional dynamic role ID', required: false })
  @IsUUID()
  @IsOptional()
  roleId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;
}