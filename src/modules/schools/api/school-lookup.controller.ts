import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { SchoolsService } from '../application/schools.service';

@ApiTags('schools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools')
export class SchoolLookupController {
  constructor(private readonly schools: SchoolsService) {}

  @Get(':schoolId')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'Get school details by ID (no org context required)' })
  getOne(@Param('schoolId') schoolId: string) {
    return this.schools.getByIdDirect(schoolId);
  }

  @Get(':schoolId/guardians/me/students')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List students linked to the authenticated guardian' })
  getGuardianStudents(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schools.getGuardianStudents(schoolId, user.userId);
  }
}
