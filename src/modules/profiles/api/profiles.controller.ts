import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { ProfilesService } from '../application/profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadAvatarDto } from './dto/upload-avatar.dto';

@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile' })
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.findByUserId(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update my profile' })
  async updateMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user.userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Set my avatar URL' })
  async setAvatar(@CurrentUser() user: AuthenticatedUser, @Body() dto: UploadAvatarDto) {
    return this.profiles.setAvatar(user.userId, dto.avatarUrl);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove my avatar' })
  async clearAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.clearAvatar(user.userId);
  }
}
