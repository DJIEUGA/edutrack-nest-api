import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ForbiddenError } from '@common/errors/domain.errors';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { UserRole } from '@common/types/role.types';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { RolesService } from '@modules/roles/application/roles.service';
import { CreateUserDto } from '../api/dto/create-user.dto';
import { UpdateUserDto } from '../api/dto/update-user.dto';
import { ResetPasswordDto } from '../api/dto/reset-password.dto';
import { UsersService } from '../application/users.service';
import { UserDetailDto, UserSearchResponseDto, UserListItemDto } from './dto/user-search-response.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/users')
export class UsersController {
  private static readonly PRIVILEGED_ROLES: UserRole[] = ['owner', 'admin', 'director'];

  constructor(
    private readonly usersService: UsersService,
    private readonly roleResolver: RoleResolverService,
    private readonly rolesService: RolesService,
  ) {}

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a new user account and link to school' })
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.createInSchool(actor.userId, schoolId, dto);
  }

  @Get()
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'List all users belonging to this school' })
  @ApiOkResponse({ type: [UserListItemDto] })
  list(@Param('schoolId') schoolId: string): Promise<UserListItemDto[]> {
    return this.usersService.listBySchool(schoolId);
  }

  @Get('search')
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'Search and filter users in the school with pagination' })
  @ApiOkResponse({ type: UserSearchResponseDto })
  async search(
    @Param('schoolId') schoolId: string,
    @Query('q') query?: string,
    @Query('role') role?: UserRole,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ): Promise<UserSearchResponseDto> {
    return this.usersService.searchInSchool(schoolId, query, role, limit, offset);
  }

  @Get(':userId')
  @Roles('owner', 'admin', 'director', 'admin', 'hod', 'lecturer', 'student', 'guardian')
  @ApiOperation({ summary: 'Get details of a specific user in the school. Any member may fetch their own profile; privileged roles may fetch any member.' })
  async getOne(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (actor.userId !== userId) {
      const isPrivileged = await this.roleResolver.userHasRoleInSchool(
        actor.userId,
        schoolId,
        UsersController.PRIVILEGED_ROLES,
      );
      if (!isPrivileged) {
        throw new ForbiddenError('You can only view your own profile');
      }
    }
    return this.usersService.getByIdInSchool(userId, schoolId);
  }

  @Patch(':userId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update user profile or account status' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateInSchool(userId, schoolId, dto);
  }

  @Delete(':userId')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a user from this school (does not delete account globally)' })
  remove(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.removeFromSchool(actor.userId, userId, schoolId);
  }

  @Post(':userId/password-reset')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Reset a user\'s password (Admin/Owner only)' })
  resetPassword(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.resetPassword(actor.userId, userId, schoolId, dto);
  }
}