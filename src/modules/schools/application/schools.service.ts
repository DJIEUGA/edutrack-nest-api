import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { School, SchoolStatus } from '../domain/school.entity';
import { SchoolRepository } from '../infrastructure/school.repository';

@Injectable()
export class SchoolsService {
  constructor(private readonly schools: SchoolRepository) {}

  list(organizationId: string): Promise<School[]> {
    return this.schools.listByOrganization(organizationId);
  }

  async getById(organizationId: string, schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId);
    if (!school || school.organizationId !== organizationId) {
      throw new NotFoundError('School not found', { schoolId });
    }
    return school;
  }

  async create(input: {
    organizationId: string;
    name: string;
    code: string;
    creatorUserId: string;
  }): Promise<School> {
    const existing = await this.schools.findByOrgAndCode(input.organizationId, input.code);
    if (existing) {
      throw new ConflictError('School code already in use within this organization', {
        code: input.code,
      });
    }
    return this.schools.createWithMembership(input);
  }

  async update(
    organizationId: string,
    schoolId: string,
    patch: { name?: string; status?: SchoolStatus },
  ): Promise<School> {
    await this.getById(organizationId, schoolId);
    const updated = await this.schools.update(schoolId, patch);
    if (!updated) throw new NotFoundError('School not found', { schoolId });
    return updated;
  }
}
