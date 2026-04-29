import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationError } from '@common/errors/domain.errors';
import { AcademicYear } from '../domain/academic-year.entity';
import { AcademicYearRepository } from '../infrastructure/academic-year.repository';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly years: AcademicYearRepository) {}

  list(schoolId: string): Promise<AcademicYear[]> {
    return this.years.list(schoolId);
  }

  async getActive(schoolId: string): Promise<AcademicYear> {
    const active = await this.years.findActive(schoolId);
    if (!active) throw new NotFoundError('No active academic year for school', { schoolId });
    return active;
  }

  async getById(schoolId: string, id: string): Promise<AcademicYear> {
    const year = await this.years.findById(id);
    if (!year || year.schoolId !== schoolId) {
      throw new NotFoundError('Academic year not found', { id });
    }
    return year;
  }

  async create(input: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  }): Promise<AcademicYear> {
    if (input.startDate >= input.endDate) {
      throw new ValidationError('startDate must be before endDate');
    }
    return this.years.create({
      schoolId: input.schoolId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive: input.isActive ?? false,
    });
  }

  async update(
    schoolId: string,
    id: string,
    patch: Partial<{ name: string; startDate: string; endDate: string; isActive: boolean }>,
  ): Promise<AcademicYear> {
    const existing = await this.getById(schoolId, id);
    const start = patch.startDate ?? existing.startDate;
    const end = patch.endDate ?? existing.endDate;
    if (start >= end) {
      throw new ConflictError('startDate must be before endDate');
    }
    const updated = await this.years.update(id, schoolId, patch);
    if (!updated) throw new NotFoundError('Academic year not found', { id });
    return updated;
  }
}
