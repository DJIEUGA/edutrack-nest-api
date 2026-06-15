import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedRequest } from '@common/types/authenticated-request';
import { AttendanceService } from '../application/attendance.service';
import { BulkMarkAttendanceDto, MarkAttendanceDto } from './dto/attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('sessions/:sessionId/attendance')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List attendance records for a session' })
  listBySession(
    @Param('schoolId') schoolId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.attendance.getSessionAttendance(schoolId, sessionId);
  }

  @Get('students/:studentId/attendance')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: "List a student's attendance history" })
  listByStudent(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.attendance.listByStudent(schoolId, studentId);
  }

  @Post('sessions/:sessionId/attendance')
  @TenantScope({ level: 'school' })
  @Roles('lecturer', 'admin', 'owner')
  @ApiOperation({ summary: 'Mark attendance for a single student' })
  mark(
    @Param('schoolId') schoolId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.attendance.bulkMark(
      schoolId,
      sessionId,
      user.userId,
      [{ studentId: dto.studentId, status: dto.status }]
    );
  }

  @Post('sessions/:sessionId/attendance/bulk')
  @TenantScope({ level: 'school' })
  @Roles('lecturer', 'admin', 'owner')
  @ApiOperation({ summary: 'Bulk-mark attendance for a session' })
  bulkMark(
    @Param('schoolId') schoolId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: BulkMarkAttendanceDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.attendance.bulkMark(schoolId, sessionId, user.userId, dto.entries);
  }

  @Get('attendance/summary')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'lecturer','student', 'guardian')
  @ApiOperation({ summary: 'Attendance summary for all students in the school' })
  summary(
    @Param('schoolId') schoolId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.attendance.getSummary(schoolId, { academicYearId, sessionId });
  }

  @Get('students/:studentId/attendance/summary')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'lecturer')
  @ApiOperation({ summary: 'Aggregated attendance summary for a single student' })
  studentSummary(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.attendance.getStudentSummary(schoolId, studentId, academicYearId);
  }
}
