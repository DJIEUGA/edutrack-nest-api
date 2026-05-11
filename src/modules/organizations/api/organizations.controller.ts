import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { OrganizationsService } from '../application/organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations the current user belongs to' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.orgs.listForUser(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new organization (caller becomes owner)' })
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orgs.create({
      name: dto.name,
      code: dto.code,
      logoUrl: dto.logoUrl,
      ownerUserId: user.userId,
    });
  }

  @Get(':organizationId')
  @TenantScope({ level: 'organization' })
  @ApiOperation({ summary: 'Get organization details' })
  getOne(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgs.getForUser(organizationId, user.userId);
  }

  @Patch(':organizationId')
  @TenantScope({ level: 'organization' })
  @Roles('owner')
  @ApiOperation({ summary: 'Update organization name, code, or logo' })
  update(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgs.update(organizationId, user.userId, dto);
  }

  @Delete(':organizationId')
  @TenantScope({ level: 'organization' })
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete an organization' })
  async remove(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.orgs.delete(organizationId, user.userId);
    return { success: true };
  }
}
