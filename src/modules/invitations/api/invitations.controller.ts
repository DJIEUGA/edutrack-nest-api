import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedRequest } from '@common/types/authenticated-request';
import { InvitationsService } from '../application/invitations.service';
import { CreateInvitationDto } from './dto/invitation.dto';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'List staff invitations for a school' })
  list(@Param('schoolId') schoolId: string) {
    return this.invitations.listBySchool(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Send a staff invitation' })
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.invitations.create({ schoolId, ...dto, invitedBy: user.userId });
  }

  @Delete(':id')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending invitation' })
  cancel(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.invitations.cancel(schoolId, id);
  }
}

@ApiTags('invitations')
@Controller('invitations')
export class InvitationAcceptController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('accept/:token')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept an invitation by token (public)' })
  accept(@Param('token') token: string) {
    return this.invitations.accept(token);
  }
}
