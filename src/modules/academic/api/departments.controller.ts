import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { DepartmentsService } from '../application/departments.service';
import { CreateDepartmentDto } from './dto/department.dto';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List departments' })
  list(@Param('schoolId') schoolId: string) {
    return this.departments.list(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a department' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateDepartmentDto) {
    return this.departments.create({ schoolId, ...dto });
  }
}
