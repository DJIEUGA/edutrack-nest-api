import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { CourseAssignmentsService } from '../application/course-assignments.service';
import { CreateCourseAssignmentDto } from './dto/course-assignment.dto';

class ListCourseAssignmentsQuery {
  @IsOptional()
  @IsUUID()
  lecturerUserId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

@ApiTags('course-assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/course-assignments')
export class CourseAssignmentsController {
  constructor(private readonly assignments: CourseAssignmentsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List course assignments (with optional filters)' })
  list(@Param('schoolId') schoolId: string, @Query() q: ListCourseAssignmentsQuery) {
    return this.assignments.list(schoolId, {
      lecturerUserId: q.lecturerUserId,
      academicYearId: q.academicYearId,
    });
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Assign a course to a lecturer/class for an academic year' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateCourseAssignmentDto) {
    return this.assignments.create({ schoolId, ...dto });
  }
}
