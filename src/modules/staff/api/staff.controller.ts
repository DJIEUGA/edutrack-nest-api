import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { StaffService } from '../application/staff.service';
import { ChangeRoleDto, GrantPermissionDto, StaffListQuery } from './dto/staff.dto';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian')
  @ApiOperation({ summary: 'List all staff members (admin, director, hod, lecturer) in this school' })
  list(
    @Param('schoolId') schoolId: string,
    @Query() query: StaffListQuery,
  ) {
    return this.staff.listStaff(schoolId, {
      role: query.role,
      departmentId: query.departmentId,
      q: query.q,
    });
  }

  @Get(':userId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer')
  @ApiOperation({ summary: 'Get a staff member profile with course assignments and invitation history' })
  getOne(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.staff.getStaffProfile(schoolId, actor.userId, userId);
  }

  @Patch(':userId/role')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Atomically change a staff member\'s role (removes fromRole, assigns toRole with optional department)',
  })
  async changeRole(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.staff.changeRole({
      schoolId,
      actorUserId: actor.userId,
      targetUserId: userId,
      fromRole: dto.fromRole,
      toRole: dto.toRole,
      departmentId: dto.departmentId,
    });
    return { success: true };
  }

  @Delete(':userId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a staff member from this school (course assignments are preserved)' })
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.staff.removeStaff(schoolId, actor.userId, userId);
    return { success: true };
  }

  @Post(':userId/permissions')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Grant an extra permission to a staff member (actor must outrank target)' })
  grantPermission(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() dto: GrantPermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.staff.grantPermission(schoolId, actor.userId, userId, dto.permissionCode);
  }

  @Delete(':userId/permissions/:permissionCode')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific permission from a staff member (actor must outrank target)' })
  async revokePermission(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Param('permissionCode') permissionCode: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.staff.revokePermission(schoolId, actor.userId, userId, permissionCode);
    return { success: true };
  }
}
