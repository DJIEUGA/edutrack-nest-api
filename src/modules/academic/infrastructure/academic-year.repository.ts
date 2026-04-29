import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AcademicYear } from '../domain/academic-year.entity';

@Injectable()
export class AcademicYearRepository {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly repo: Repository<AcademicYear>,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<AcademicYear | null> {
    return this.repo.findOne({ where: { id } });
  }

  findActive(schoolId: string): Promise<AcademicYear | null> {
    return this.repo.findOne({ where: { schoolId, isActive: true } });
  }

  list(schoolId: string): Promise<AcademicYear[]> {
    return this.repo.find({ where: { schoolId }, order: { startDate: 'DESC' } });
  }

  /**
   * Creates a year. If isActive=true, deactivates any other active year for the school
   * inside the same transaction (one active year per school).
   */
  async create(input: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }): Promise<AcademicYear> {
    return this.dataSource.transaction(async (manager) => {
      if (input.isActive) {
        await manager
          .getRepository(AcademicYear)
          .update({ schoolId: input.schoolId, isActive: true }, { isActive: false });
      }
      const created = manager.getRepository(AcademicYear).create(input);
      return manager.getRepository(AcademicYear).save(created);
    });
  }

  async update(
    id: string,
    schoolId: string,
    patch: Partial<Pick<AcademicYear, 'name' | 'startDate' | 'endDate' | 'isActive'>>,
  ): Promise<AcademicYear | null> {
    return this.dataSource.transaction(async (manager) => {
      if (patch.isActive === true) {
        await manager
          .getRepository(AcademicYear)
          .createQueryBuilder()
          .update(AcademicYear)
          .set({ isActive: false })
          .where('school_id = :schoolId AND id <> :id', { schoolId, id })
          .execute();
      }
      await manager.getRepository(AcademicYear).update({ id }, patch);
      return manager.getRepository(AcademicYear).findOne({ where: { id } });
    });
  }
}
