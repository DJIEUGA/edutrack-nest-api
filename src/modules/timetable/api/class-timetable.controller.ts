import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { ClassTimetableService } from '../application/class-timetable.service';

@ApiTags('class-timetable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/classes/:classId/timetable')
export class ClassTimetableController {
  constructor(
    private readonly classTimetable: ClassTimetableService,
    private readonly roleResolver: RoleResolverService,
  ) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer', 'student')
  @ApiOperation({ summary: 'Get the shared timetable grid for a class' })
  @ApiQuery({ name: 'academicYearId', required: false, type: String })
  async getSharedTimetable(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const roles = await this.roleResolver.listRolesForUser(user.userId, schoolId);
    return this.classTimetable.getSharedTimetable(schoolId, classId, user.userId, roles, academicYearId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod', 'lecturer')
  @ApiOperation({ summary: 'Add a timetable slot for a course in this class' })
  async create(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: {
      academicYearId: string;
      courseAssignmentId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      venue?: string;
    },
  ) {
    const roles = await this.roleResolver.listRolesForUser(user.userId, schoolId);
    return this.classTimetable.createSlot(schoolId, classId, user.userId, roles, dto);
  }

  @Patch(':slotId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod', 'lecturer')
  @ApiOperation({ summary: 'Update a timetable slot for this class' })
  async update(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { dayOfWeek?: number; startTime?: string; endTime?: string; venue?: string },
  ) {
    const roles = await this.roleResolver.listRolesForUser(user.userId, schoolId);
    return this.classTimetable.updateSlot(schoolId, classId, slotId, user.userId, roles, dto);
  }

  @Delete(':slotId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod', 'lecturer')
  @ApiOperation({ summary: 'Remove a timetable slot from this class' })
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const roles = await this.roleResolver.listRolesForUser(user.userId, schoolId);
    return this.classTimetable.deleteSlot(schoolId, classId, slotId, user.userId, roles);
  }
}
