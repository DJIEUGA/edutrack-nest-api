import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { School } from '../domain/school.entity';
import { SchoolMembership } from '../domain/school-membership.entity';

@Injectable()
export class SchoolRepository {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(SchoolMembership)
    private readonly memberRepo: Repository<SchoolMembership>,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<School | null> {
    return this.schoolRepo.findOne({ where: { id } });
  }

  listByOrganization(organizationId: string): Promise<School[]> {
    return this.schoolRepo.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
  }

  findByOrgAndCode(organizationId: string, code: string): Promise<School | null> {
    return this.schoolRepo.findOne({ where: { organizationId, code } });
  }

  async createWithMembership(input: {
    organizationId: string;
    name: string;
    code: string;
    creatorUserId: string;
  }): Promise<School> {
    return this.dataSource.transaction(async (manager) => {
      const school = manager.getRepository(School).create({
        organizationId: input.organizationId,
        name: input.name,
        code: input.code,
        status: 'active',
      });
      const saved = await manager.getRepository(School).save(school);
      const membership = manager.getRepository(SchoolMembership).create({
        schoolId: saved.id,
        userId: input.creatorUserId,
      });
      await manager.getRepository(SchoolMembership).save(membership);
      return saved;
    });
  }

  async update(
    id: string,
    patch: Partial<Pick<School, 'name' | 'status'>>,
  ): Promise<School | null> {
    await this.schoolRepo.update({ id }, patch);
    return this.findById(id);
  }
}
