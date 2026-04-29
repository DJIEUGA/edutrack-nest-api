import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { SpecialtiesService } from '../application/specialties.service';
import { CreateSpecialtyDto } from './dto/specialty.dto';

class ListSpecialtiesQuery {
  @IsOptional()
  @IsUUID()
  programId?: string;
}

@ApiTags('specialties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/specialties')
export class SpecialtiesController {
  constructor(private readonly specialties: SpecialtiesService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List specialties (optionally filtered by program)' })
  list(@Param('schoolId') schoolId: string, @Query() query: ListSpecialtiesQuery) {
    return this.specialties.list(schoolId, query.programId);
  }

  @Post('programs/:programId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Create a specialty under a program' })
  create(
    @Param('schoolId') schoolId: string,
    @Param('programId') programId: string,
    @Body() dto: CreateSpecialtyDto,
  ) {
    return this.specialties.create({ schoolId, programId, ...dto });
  }
}
