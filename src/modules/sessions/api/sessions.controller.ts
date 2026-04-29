import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedRequest } from '@common/types/authenticated-request';
import { SessionsService } from '../application/sessions.service';
import { CreateSessionDto, StartSessionDto } from './dto/session.dto';

class ListSessionsQuery {
  @IsOptional()
  @IsUUID()
  courseAssignmentId?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;
}

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List sessions' })
  list(@Param('schoolId') schoolId: string, @Query() q: ListSessionsQuery) {
    return this.sessions.list(schoolId, {
      courseAssignmentId: q.courseAssignmentId,
      scheduledDate: q.scheduledDate,
    });
  }

  @Get(':id')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'Get session by id' })
  getById(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.sessions.getById(schoolId, id);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod', 'lecturer')
  @ApiOperation({ summary: 'Create a session' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateSessionDto) {
    return this.sessions.create({ schoolId, ...dto });
  }

  @Post(':id/start')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'Start a session (lecturer geo-check-in)' })
  start(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() dto: StartSessionDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.sessions.start(schoolId, id, { startedBy: user.userId, ...dto });
  }

  @Post(':id/end')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'End a session' })
  end(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.sessions.end(schoolId, id, user.userId);
  }

  @Post(':id/cancel')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a session' })
  cancel(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.sessions.cancel(schoolId, id);
  }
}
