import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { PermissionsService } from './application/permissions.service';
import { RolesService } from './application/roles.service';
import { RoleResolverService } from './application/role-resolver.service';
import { TenantMembershipService } from './application/tenant-membership.service';
import { SchoolCreatedListener } from './application/school-created.listener';
import { UserRoleRepository } from './infrastructure/user-role.repository';
import { UserRoleAssignment } from './domain/user-role.entity';
import { SystemAdminController } from './api/system-admin.controller';
import { RolesController } from './api/roles.controller';
import { OrganizationMembership } from '@modules/organizations/domain/organization-membership.entity';
import { SchoolMembership } from '@modules/schools/domain/school-membership.entity';
import { School } from '@modules/schools/domain/school.entity';

@Module({
  imports: [
    CacheModule.register(),
    TypeOrmModule.forFeature([UserRoleAssignment, OrganizationMembership, SchoolMembership, School]),
  ],
  controllers: [SystemAdminController, RolesController],
  providers: [
    PermissionsService,
    RolesService,
    RoleResolverService,
    TenantMembershipService,
    UserRoleRepository,
    SchoolCreatedListener,
  ],
  exports: [PermissionsService, RolesService, RoleResolverService, TenantMembershipService, UserRoleRepository],
})
export class RolesModule {}
