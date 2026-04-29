import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { TimetableService } from '../application/timetable.service';
import { CreateTimetableSlotDto } from './dto/timetable-slot.dto';

class ListSlotsQuery {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  courseAssignmentId?: string;
}

@ApiTags('timetable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/timetable')
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List timetable slots' })
  list(@Param('schoolId') schoolId: string, @Query() q: ListSlotsQuery) {
    return this.timetable.list(schoolId, {
      academicYearId: q.academicYearId,
      courseAssignmentId: q.courseAssignmentId,
    });
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Create a timetable slot' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateTimetableSlotDto) {
    return this.timetable.create({ schoolId, ...dto });
  }

  @Delete(':id')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a timetable slot' })
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.timetable.remove(schoolId, id);
  }
}
