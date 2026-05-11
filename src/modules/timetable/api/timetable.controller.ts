import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { TimetableService } from '../application/timetable.service';

@ApiTags('timetable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/timetable')
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian')
  @ApiOperation({ summary: 'List timetable slots for a school' })
  list(@Param('schoolId') schoolId: string) {
    return this.timetable.list(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Create a new timetable slot' })
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: { academicYearId: string; courseAssignmentId: string; dayOfWeek: number; startTime: string; endTime: string; venue?: string },
  ) {
    return this.timetable.create(schoolId, dto);
  }

  @Patch(':slotId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod') // Lecturers might have 'reschedule-own' capability, requiring finer-grained check
  @ApiOperation({ summary: 'Update an existing timetable slot (reschedule)' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('slotId') slotId: string,
    @Body() dto: { dayOfWeek?: number; startTime?: string; endTime?: string; venue?: string },
  ) {
    return this.timetable.update(schoolId, slotId, dto);
  }

  @Delete(':slotId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Remove a timetable slot' })
  remove(@Param('schoolId') schoolId: string, @Param('slotId') slotId: string) {
    return this.timetable.remove(schoolId, slotId);
  }
}