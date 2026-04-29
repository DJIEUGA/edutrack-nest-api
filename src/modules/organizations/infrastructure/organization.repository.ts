import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Organization } from '../domain/organization.entity';
import { OrganizationMembership } from '../domain/organization-membership.entity';

@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly memberRepo: Repository<OrganizationMembership>,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<Organization | null> {
    return this.orgRepo.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Organization | null> {
    return this.orgRepo.findOne({ where: { code } });
  }

  async listForUser(userId: string): Promise<Organization[]> {
    return this.orgRepo
      .createQueryBuilder('o')
      .innerJoin(OrganizationMembership, 'm', 'm.organization_id = o.id')
      .where('m.user_id = :userId', { userId })
      .orderBy('o.created_at', 'ASC')
      .getMany();
  }

  /**
   * Creates an organization and the owner membership atomically.
   */
  async createWithOwner(input: {
    name: string;
    code: string;
    logoUrl?: string | null;
    ownerUserId: string;
  }): Promise<Organization> {
    return this.dataSource.transaction(async (manager) => {
      const org = manager.getRepository(Organization).create({
        name: input.name,
        code: input.code,
        logoUrl: input.logoUrl ?? null,
        createdBy: input.ownerUserId,
      });
      const saved = await manager.getRepository(Organization).save(org);
      const membership = manager.getRepository(OrganizationMembership).create({
        organizationId: saved.id,
        userId: input.ownerUserId,
        role: 'owner',
      });
      await manager.getRepository(OrganizationMembership).save(membership);
      return saved;
    });
  }
}
