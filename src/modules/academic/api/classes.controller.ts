import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ClassesService } from '../application/classes.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';

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

  @Patch(':classId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a class' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classes.update(schoolId, classId, dto);
  }

  @Delete(':classId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a class' })
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
  ) {
    await this.classes.delete(schoolId, classId);
    return { success: true };
  }
}
