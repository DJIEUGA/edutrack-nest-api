import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { PaginationDto } from '@common/dto/pagination.dto';
import { AuditLogRepository } from '../infrastructure/audit-log.repository';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/audit-logs')
export class AuditController {
  constructor(private readonly repo: AuditLogRepository) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'List audit logs for the current school' })
  async list(@Param('schoolId') schoolId: string, @Query() page: PaginationDto) {
    const [items, total] = await this.repo.listForSchool(schoolId, page.take, page.skip);
    return { items, meta: { page: page.page, pageSize: page.pageSize, total } };
  }
}
