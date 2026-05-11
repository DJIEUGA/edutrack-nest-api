import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AcademicYearsService } from '../application/academic-years.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';

@ApiTags('academic-years')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/academic-years')
export class AcademicYearsController {
  constructor(private readonly years: AcademicYearsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List academic years for a school' })
  list(@Param('schoolId') schoolId: string) {
    return this.years.list(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create an academic year' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateAcademicYearDto) {
    return this.years.create(schoolId, dto);
  }

  @Patch(':academicYearId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update an academic year' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('academicYearId') academicYearId: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.years.update(schoolId, academicYearId, dto);
  }
}
