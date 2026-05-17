import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { UserRole, USER_ROLES } from '@common/types/role.types';
import { RolesService } from '../application/roles.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { PermissionsService } from '../application/permissions.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/user-roles')
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get(':userId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'admin', 'hod', 'lecturer', 'student', 'guardian')
  @ApiOperation({ summary: 'List a user\'s roles in this school' })
  async list(@Param('schoolId') schoolId: string, @Param('userId') userId: string) {
    return this.roles.listUserRolesBySchool(userId, schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Assign a role to a user in this school (hierarchy enforced in service)' })
  async assign(
    @Param('schoolId') schoolId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.roles.assignRole({
      actorUserId: actor.userId,
      schoolId,
      targetUserId: dto.userId,
      role: dto.role,
      roleId: dto.roleId,
      departmentId: dto.departmentId,
    });
  }

  @Delete(':userId/:role')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a role from a user in this school (hierarchy enforced in service)' })
  async revoke(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Param('role') role: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!(USER_ROLES as readonly string[]).includes(role)) {
      throw new Error('Invalid role');
    }
    await this.roles.revokeRole({
      actorUserId: actor.userId,
      schoolId,
      targetUserId: userId,
      role: role as UserRole,
    });
  }

  @Get('permissions/catalog')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'List all available system permissions' })
  async listAvailablePermissions(@Param('schoolId') schoolId: string) {
    return this.permissions.findAll();
  }

  @Post('permissions')
  @TenantScope({ level: 'school' })
  @Roles('owner')
  @ApiOperation({ summary: 'Create a new global permission (Owner only)' })
  async createPermission(@Param('schoolId') schoolId: string, @Body() dto: CreatePermissionDto) {
    return this.permissions.create(dto);
  }

  @Post(':userId/permissions')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Assign specific permission to a user (use /staff/:userId/permissions for hierarchy-enforced grant)' })
  async assignPermission(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body('permissionCode') permissionCode: string,
  ) {
    return this.permissions.assignToUser({
      userId,
      schoolId,
      permissionCode,
    });
  }

  @Get('roles/catalog')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'List all dynamic roles in this school' })
  async listRoles(@Param('schoolId') schoolId: string) {
    return this.permissions.findAllRoles(schoolId);
  }

  @Post('roles')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a new dynamic role' })
  async createRole(@Param('schoolId') schoolId: string, @Body() dto: { code: string; name: string }) {
    return this.permissions.createRole(schoolId, dto);
  }

  @Post('permissions/bulk-assign-role')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Assign permission to all users with a specific role' })
  async assignPermissionToRole(
    @Param('schoolId') schoolId: string,
    @Body('role') role: UserRole,
    @Body('permissionCode') permissionCode: string,
  ) {
    return this.permissions.assignToRole({ schoolId, role, permissionCode });
  }

  @Delete(':userId/permissions/:permissionCode')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke specific permission from a user' })
  async revokePermission(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Param('permissionCode') permissionCode: string,
  ) {
    await this.permissions.revokeFromUser({
      userId,
      schoolId,
      permissionCode,
    });
  }
}
