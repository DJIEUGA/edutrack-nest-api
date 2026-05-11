import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { SessionReportingService } from '../application/session-reporting.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/reports')
export class SessionReportingController {
  constructor(private readonly reportingService: SessionReportingService) {}

  @Get('sessions/geo-compliance')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'Sessions violating geo-fence or missing location data' })
  getGeoCompliance(
    @Param('schoolId') schoolId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.reportingService.getGeoComplianceReport(schoolId, limit, offset);
  }

  @Get('enrollment')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'Enrollment counts by status and department' })
  @ApiQuery({ name: 'academicYearId', required: false })
  getEnrollment(
    @Param('schoolId') schoolId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.reportingService.getEnrollmentReport(schoolId, academicYearId);
  }

  @Get('attendance')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'Attendance trend report by week or month' })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month'] })
  getAttendanceTrend(
    @Param('schoolId') schoolId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('period') period?: 'week' | 'month',
  ) {
    return this.reportingService.getAttendanceTrendReport(schoolId, { academicYearId, period });
  }
}