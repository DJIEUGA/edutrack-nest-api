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