import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ImportsService } from '../application/imports.service';
import { CreateImportJobDto } from './dto/import-job.dto';
import { CurrentUser  } from '@common/decorators/current-user.decorator';

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'List all import jobs for the school' })
  async list(@Param('schoolId') schoolId: string) {
    return this.importsService.listJobs(schoolId);
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Initiate a new import job (Phase 1: Upload)' })
  async create(@Param('schoolId') schoolId: string, @CurrentUser() user: any, @Body() dto: CreateImportJobDto) {
    return this.importsService.createJob(schoolId, user.id, {
      type: dto.type,
      sourceFileUrl: dto.sourceFileUrl!,
    });
  }

  @Get(':importId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Get import job details (Phase 2: Review Validation)' })
  async getOne(@Param('schoolId') schoolId: string, @Param('importId') importId: string) {
    return this.importsService.getJob(importId, schoolId);
  }

  @Post(':importId/commit')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Commit the validated records (Phase 3: Commit)' })
  async commit(@Param('schoolId') schoolId: string, @Param('importId') importId: string) {
    return this.importsService.commitJob(importId, schoolId);
  }

  @Delete(':importId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Cancel a pending or validated import job' })
  async remove(@Param('schoolId') schoolId: string, @Param('importId') importId: string) {
    return this.importsService.cancelJob(importId, schoolId);
  }
}