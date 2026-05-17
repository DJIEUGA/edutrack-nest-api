import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Organization } from '../domain/organization.entity';
import { OrganizationMembership, MembershipRole } from '../domain/organization-membership.entity';

export type OrganizationWithRole = Organization & { memberRole: MembershipRole };

const ORG_COLUMNS = `
  o.id,
  o.name,
  o.code,
  o.logo_url       AS "logoUrl",
  o.created_by     AS "createdBy",
  o.created_at     AS "createdAt",
  o.updated_at     AS "updatedAt",
  m.role           AS "memberRole"
`;

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

  async listForUser(userId: string): Promise<OrganizationWithRole[]> {
    return this.dataSource.query(
      `SELECT ${ORG_COLUMNS}
       FROM organizations o
       INNER JOIN organization_memberships m ON m.organization_id = o.id AND m.user_id = $1
       ORDER BY o.created_at ASC`,
      [userId],
    );
  }

  async findByIdForUser(id: string, userId: string): Promise<OrganizationWithRole | null> {
    const [row] = await this.dataSource.query(
      `SELECT ${ORG_COLUMNS}
       FROM organizations o
       INNER JOIN organization_memberships m ON m.organization_id = o.id AND m.user_id = $2
       WHERE o.id = $1`,
      [id, userId],
    );
    return row ?? null;
  }

  async update(id: string, patch: { name?: string; code?: string; logoUrl?: string | null }): Promise<Organization | null> {
    await this.orgRepo.update({ id }, patch);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.orgRepo.delete({ id });
  }

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
