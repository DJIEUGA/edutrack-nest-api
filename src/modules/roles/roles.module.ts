import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantGuard } from '@common/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { AuditModule } from '@modules/audit/audit.module';
import { OrganizationMembership } from '@modules/organizations/domain/organization-membership.entity';
import { School } from '@modules/schools/domain/school.entity';
import { SchoolMembership } from '@modules/schools/domain/school-membership.entity';
import { RolesController } from './api/roles.controller';
import { RoleResolverService } from './application/role-resolver.service';
import { RolesService } from './application/roles.service';
import { TenantMembershipService } from './application/tenant-membership.service';
import { UserRoleAssignment } from './domain/user-role.entity';
import { UserRoleRepository } from './infrastructure/user-role.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserRoleAssignment,
      OrganizationMembership,
      SchoolMembership,
      School,
    ]),
    AuditModule,
  ],
  controllers: [RolesController],
  providers: [
    RolesService,
    RoleResolverService,
    TenantMembershipService,
    UserRoleRepository,
    RolesGuard,
    TenantGuard,
  ],
  exports: [RoleResolverService, TenantMembershipService, RolesService, UserRoleRepository],
})
export class RolesModule {}
