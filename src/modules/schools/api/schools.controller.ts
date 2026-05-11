import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { SchoolsService } from '../application/schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@ApiTags('schools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('organizations/:organizationId/schools')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  @TenantScope({ level: 'organization' })
  @ApiOperation({ summary: 'List schools in an organization' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'q', required: false })
  list(
    @Param('organizationId') organizationId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.schools.list(organizationId, { status, q });
  }

  @Post()
  @TenantScope({ level: 'organization' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a school within an organization' })
  create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateSchoolDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schools.create({
      organizationId,
      name: dto.name,
      code: dto.code,
      creatorUserId: user.userId,
    });
  }

  @Get(':schoolId')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'Get school details' })
  getOne(
    @Param('organizationId') organizationId: string,
    @Param('schoolId') schoolId: string,
  ) {
    return this.schools.getById(organizationId, schoolId);
  }

  @Patch(':schoolId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update school settings' })
  update(
    @Param('organizationId') organizationId: string,
    @Param('schoolId') schoolId: string,
    @Body() dto: UpdateSchoolDto,
  ) {
    return this.schools.update(organizationId, schoolId, dto);
  }

  @Post(':schoolId/logo')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Set the school logo URL' })
  setLogo(
    @Param('organizationId') organizationId: string,
    @Param('schoolId') schoolId: string,
    @Body() dto: { logoUrl: string },
  ) {
    return this.schools.setLogo(organizationId, schoolId, dto.logoUrl);
  }

  @Delete(':schoolId/logo')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Remove the school logo' })
  removeLogo(
    @Param('organizationId') organizationId: string,
    @Param('schoolId') schoolId: string,
  ) {
    return this.schools.setLogo(organizationId, schoolId, null);
  }

  @Delete(':schoolId')
  @TenantScope({ level: 'school' })
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a school (must be inactive first)' })
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('schoolId') schoolId: string,
  ) {
    await this.schools.delete(organizationId, schoolId);
    return { success: true };
  }
}
