import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { UserRole, USER_ROLES } from '@common/types/role.types';

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsIn([...USER_ROLES])
  role!: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
