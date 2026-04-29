import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationMembership } from '@modules/organizations/domain/organization-membership.entity';
import { SchoolMembership } from '@modules/schools/domain/school-membership.entity';
import { School } from '@modules/schools/domain/school.entity';

@Injectable()
export class TenantMembershipService {
  constructor(
    @InjectRepository(OrganizationMembership)
    private readonly orgMembership: Repository<OrganizationMembership>,
    @InjectRepository(SchoolMembership)
    private readonly schoolMembership: Repository<SchoolMembership>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async userBelongsToOrganization(userId: string, organizationId: string): Promise<boolean> {
    const count = await this.orgMembership.count({ where: { organizationId, userId } });
    return count > 0;
  }

  async userBelongsToSchool(userId: string, schoolId: string): Promise<boolean> {
    const direct = await this.schoolMembership.count({ where: { schoolId, userId } });
    if (direct > 0) return true;

    // Fall back to organization-level membership: org owners/admins implicitly access all schools.
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) return false;
    return this.userBelongsToOrganization(userId, school.organizationId);
  }
}
