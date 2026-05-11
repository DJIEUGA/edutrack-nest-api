import { Controller, Get, Patch, Param, Body, UseGuards, Req, Delete, Query } from '@nestjs/common';
import { SuperAdminGuard } from '@common/guards/super-admin.guard';
import { PermissionsService } from '../application/permissions.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@Controller('system')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SystemAdminController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('organizations')
  async listOrganizations() {
    return this.permissionsService.listAllOrganizations();
  }

  @Patch('organizations/:orgId')
  async updateOrgStatus(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Body() body: { status: 'active' | 'suspended' | 'deleted' }
  ) {
    return this.permissionsService.updateOrganizationStatus(req.user.id, orgId, body.status);
  }

  @Delete('organizations/:orgId')
  async deleteOrg(@Req() req: any, @Param('orgId') orgId: string) {
    return this.permissionsService.softDeleteOrganization(req.user.id, orgId);
  }

  @Get('users')
  async listUsers() {
    return this.permissionsService.listAllUsersGlobal();
  }

  @Patch('users/:userId/system-admin')
  async toggleAdmin(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { isSystemAdmin: boolean }
  ) {
    return this.permissionsService.toggleSystemAdminStatus(
      req.user.id,
      userId,
      body.isSystemAdmin
    );
  }

  @Get('stats')
  async getStats() {
    return this.permissionsService.getSystemStats();
  }
}