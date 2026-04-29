import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ClassesService } from '../application/classes.service';
import { CreateClassDto } from './dto/class.dto';

class ListClassesQuery {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List classes (optionally filtered by academic year)' })
  list(@Param('schoolId') schoolId: string, @Query() query: ListClassesQuery) {
    return this.classes.list(schoolId, query.academicYearId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Create a class' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateClassDto) {
    return this.classes.create({ schoolId, ...dto });
  }
}
