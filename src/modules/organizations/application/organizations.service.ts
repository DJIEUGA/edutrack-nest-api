import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { TenantMembershipService } from '@modules/roles/application/tenant-membership.service';
import { Organization } from '../domain/organization.entity';
import { OrganizationRepository } from '../infrastructure/organization.repository';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly memberships: TenantMembershipService,
  ) {}

  listForUser(userId: string): Promise<Organization[]> {
    return this.orgs.listForUser(userId);
  }

  async getForUser(organizationId: string, userId: string): Promise<Organization> {
    const allowed = await this.memberships.userBelongsToOrganization(userId, organizationId);
    if (!allowed) throw new NotFoundError('Organization not found', { organizationId });
    const org = await this.orgs.findById(organizationId);
    if (!org) throw new NotFoundError('Organization not found', { organizationId });
    return org;
  }

  async create(input: {
    name: string;
    code: string;
    logoUrl?: string;
    ownerUserId: string;
  }): Promise<Organization> {
    const existing = await this.orgs.findByCode(input.code);
    if (existing) {
      throw new ConflictError('Organization code already in use', { code: input.code });
    }
    return this.orgs.createWithOwner({
      name: input.name,
      code: input.code,
      logoUrl: input.logoUrl,
      ownerUserId: input.ownerUserId,
    });
  }
}
