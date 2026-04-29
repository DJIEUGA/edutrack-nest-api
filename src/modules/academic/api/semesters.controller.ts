import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { SemestersService } from '../application/semesters.service';
import { CreateSemesterDto } from './dto/semester.dto';

class ListSemestersQuery {
  @IsUUID()
  academicYearId!: string;
}

@ApiTags('semesters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/semesters')
export class SemestersController {
  constructor(private readonly semesters: SemestersService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List semesters for an academic year' })
  list(@Param('schoolId') _schoolId: string, @Query() query: ListSemestersQuery) {
    return this.semesters.list(query.academicYearId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a semester' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateSemesterDto) {
    return this.semesters.create({ schoolId, ...dto });
  }
}
