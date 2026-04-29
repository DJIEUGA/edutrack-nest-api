import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  list(@Param('organizationId') organizationId: string) {
    return this.schools.list(organizationId);
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
  @ApiOperation({ summary: 'Update a school' })
  update(
    @Param('organizationId') organizationId: string,
    @Param('schoolId') schoolId: string,
    @Body() dto: UpdateSchoolDto,
  ) {
    return this.schools.update(organizationId, schoolId, dto);
  }
}
