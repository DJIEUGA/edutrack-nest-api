import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { OrganizationsController } from './api/organizations.controller';
import { OrganizationsService } from './application/organizations.service';
import { Organization } from './domain/organization.entity';
import { OrganizationMembership } from './domain/organization-membership.entity';
import { OrganizationRepository } from './infrastructure/organization.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationMembership]), RolesModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationRepository],
  exports: [OrganizationsService, OrganizationRepository],
})
export class OrganizationsModule {}
