import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { CoursesService } from '../application/courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List courses' })
  list(@Param('schoolId') schoolId: string) {
    return this.courses.list(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Create a course' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateCourseDto) {
    if (dto.unitLoad === undefined) {
      throw new BadRequestException('unitLoad is required');
    }
    return this.courses.create(schoolId, {
      code: dto.code,
      title: dto.title,
      unitLoad: dto.unitLoad,
      departmentId: dto.departmentId,
    });
  }

  @Patch(':courseId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Update a course' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(schoolId, courseId, dto);
  }

  @Delete(':courseId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a course' })
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('courseId') courseId: string,
  ) {
    await this.courses.delete(schoolId, courseId);
    return { success: true };
  }
}
