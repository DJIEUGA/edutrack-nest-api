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

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/user-roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get(':userId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'List a user\'s roles in this school' })
  async list(@Param('schoolId') schoolId: string, @Param('userId') userId: string) {
    return this.roles.listUserRolesBySchool(userId, schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Assign a role to a user in this school' })
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
      departmentId: dto.departmentId,
    });
  }

  @Delete(':userId/:role')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a role from a user in this school' })
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
}
