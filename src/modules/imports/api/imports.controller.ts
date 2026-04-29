import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedRequest } from '@common/types/authenticated-request';
import { ImportsService } from '../application/imports.service';
import { CreateImportJobDto } from './dto/import-job.dto';

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'List import jobs' })
  list(@Param('schoolId') schoolId: string) {
    return this.imports.listBySchool(schoolId);
  }

  @Get(':id')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Get import job details' })
  getById(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.imports.getById(schoolId, id);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create (initiate) an import job' })
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateImportJobDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.imports.create({ schoolId, ...dto, initiatedBy: user.userId });
  }

  @Post(':id/commit')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Commit a validated import job' })
  commit(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.imports.commit(schoolId, id);
  }
}
