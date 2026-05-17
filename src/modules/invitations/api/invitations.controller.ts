import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { InvitationsService } from '../application/invitations.service';
import { CompleteRegistrationDto, CreateInvitationDto } from './dto/invitation.dto';

// ── School-scoped invitation management ───────────────────────────────────────

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'List all staff invitations for this school' })
  list(@Param('schoolId') schoolId: string) {
    return this.invitations.listBySchool(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({
    summary: 'Send a staff invitation. Returns userExists=true when the email already has an account — caller should assign the role directly instead.',
  })
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.invitations.create({
      schoolId,
      email: dto.email,
      role: dto.role,
      departmentId: dto.departmentId,
      departmentIds: dto.departmentIds,
      invitedBy: actor.userId,
    });
  }

  @Post(':id/resend')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend an expired or pending invitation (generates a fresh token)' })
  resend(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.invitations.resend(schoolId, id, actor.userId);
  }

  @Delete(':id')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending invitation' })
  cancel(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.invitations.cancel(schoolId, id, actor.userId);
  }
}

// ── Public invitation acceptance endpoints ────────────────────────────────────

@ApiTags('invitations')
@Controller('invitations')
export class InvitationAcceptController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('validate/:token')
  @Public()
  @ApiOperation({ summary: 'Validate an invitation token and return pre-fill data for the registration form' })
  validate(@Param('token') token: string) {
    return this.invitations.validateToken(token);
  }

  @Post('complete/:token')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Complete registration using an invitation token. Creates the user account, assigns school membership and role. The caller should log in afterwards.',
  })
  complete(@Param('token') token: string, @Body() dto: CompleteRegistrationDto) {
    return this.invitations.completeRegistration(token, dto);
  }
}
