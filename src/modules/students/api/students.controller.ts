import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from '../application/students.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@common/types/authenticated-request';

@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  async list(
    @Param('schoolId') schoolId: string,
    @Query('status') status?: string,
    @Query('programId') programId?: string,
    @Query('level') level?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.studentsService.search(schoolId, { status, programId, level, limit, offset });
  }

  @Get(':studentId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'lecturer')
  async getOne(@Param('schoolId') schoolId: string, @Param('studentId') studentId: string) {
    return this.studentsService.getById(schoolId, studentId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  async create(
    @Param('schoolId') schoolId: string,
    @Body() dto: { userId: string; matricNo?: string; classId?: string },
  ) {
    return this.studentsService.create(schoolId, dto);
  }

  @Patch(':studentId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  async updateStatus(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Body() dto: { status: 'approved' | 'rejected' | 'waitlisted'; rejectionReason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.studentsService.updateStatus(
      actor.userId,
      schoolId,
      studentId,
      dto.status,
      dto.rejectionReason ?? '',
    );
  }

  @Delete(':studentId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  async remove(@Param('schoolId') schoolId: string, @Param('studentId') studentId: string) {
    return this.studentsService.remove(schoolId, studentId);
  }
}