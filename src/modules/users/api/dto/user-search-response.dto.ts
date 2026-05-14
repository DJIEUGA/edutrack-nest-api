import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@common/types/role.types';

export class UserListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ example: 'John Doe' })
  fullName!: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  avatarUrl?: string;

  @ApiProperty({ enum: ['owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian', 'follower'] })
  role!: UserRole;
}

export class RoleWithPermissionsDto {
  @ApiProperty({ enum: ['owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian', 'follower'] })
  role!: UserRole;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  roleId?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  departmentId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  dynamicRoleName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  dynamicRoleCode?: string | null;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class UserDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ example: 'John Doe' })
  fullName!: string;

  @ApiProperty({ required: false, nullable: true })
  phone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({ type: [RoleWithPermissionsDto] })
  roles!: RoleWithPermissionsDto[];
}

export class UserSearchMetaDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export class UserSearchResponseDto {
  @ApiProperty({ type: [UserListItemDto] })
  items!: UserListItemDto[];

  @ApiProperty()
  meta!: UserSearchMetaDto;
}