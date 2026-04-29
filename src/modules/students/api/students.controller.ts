import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { StudentsService } from '../application/students.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

class ListStudentsQuery {
  @IsOptional()
  @IsUUID()
  classId?: string;
}

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List students (optionally filtered by class)' })
  list(@Param('schoolId') schoolId: string, @Query() q: ListStudentsQuery) {
    return this.students.list(schoolId, q.classId);
  }

  @Get(':id')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'Get student by id' })
  getById(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.students.getById(schoolId, id);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Enrol a student' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateStudentDto) {
    return this.students.create({ schoolId, ...dto });
  }

  @Patch(':id')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Update student record' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(schoolId, id, dto);
  }
}
