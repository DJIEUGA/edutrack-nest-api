import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

/**
 * V1 keeps the avatar flow lightweight: the client uploads to FilesModule (out of scope)
 * and posts back the resulting URL. The backend validates and persists the reference.
 */
export class UploadAvatarDto {
  @ApiProperty({ format: 'uri' })
  @IsString()
  @IsUrl({ require_tld: false })
  avatarUrl!: string;
}
