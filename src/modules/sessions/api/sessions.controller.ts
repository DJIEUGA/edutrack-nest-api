import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { SessionsService } from '../application/sessions.service';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian')
  @ApiOperation({ summary: 'List all sessions for a school' })
  list(@Param('schoolId') schoolId: string) {
    return this.sessions.list(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod') // Lecturers can only start/end their assigned sessions, not create new ones ad-hoc
  @ApiOperation({ summary: 'Create a new session (ad-hoc or from timetable slot)' })
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: { courseAssignmentId: string; timetableSlotId?: string; scheduledDate: string },
  ) {
    return this.sessions.create(schoolId, dto);
  }

  @Post(':sessionId/start')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'lecturer')
  @ApiOperation({ summary: 'Start a scheduled session' })
  startSession(
    @Param('schoolId') schoolId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: { lat: number; lng: number; accuracy: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.startSession(sessionId, schoolId, user.userId, dto);
  }

  @Post(':sessionId/end')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'lecturer')
  @ApiOperation({ summary: 'End a live session' })
  endSession(
    @Param('schoolId') schoolId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.endSession(sessionId, schoolId, user.userId);
  }
}