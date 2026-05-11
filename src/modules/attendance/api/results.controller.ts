import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { ResultsService } from '../application/results.service';

@ApiTags('results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Post('results/bulk')
  @TenantScope({ level: 'school' })
  @Roles('lecturer', 'admin', 'owner')
  @ApiOperation({ summary: 'Submit grades for a course' })
  submitGrades(
    @Param('schoolId') schoolId: string,
    @Body() dto: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.resultsService.submitGrades(schoolId, actor.userId, dto);
  }

  @Get('students/:studentId/results')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: "Get a student's results" })
  getStudentResults(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.resultsService.getStudentResults(studentId, academicYearId);
  }
}