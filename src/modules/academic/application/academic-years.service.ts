import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundError } from '@common/errors/domain.errors';
import { AcademicYearRepository } from '../infrastructure/academic-year.repository';

@Injectable()
export class AcademicYearsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly academicYearRepository: AcademicYearRepository,
  ) {}

  async list(schoolId: string) {
    return this.academicYearRepository.list(schoolId);
  }

  async create(schoolId: string, dto: { name: string; startDate: string; endDate: string; isActive?: boolean }) {
    return await this.dataSource.transaction(async (manager) => {
      // Section 8.2: Ensure only one active year per school
      if (dto.isActive) {
        await this.academicYearRepository.deactivateAll(manager, schoolId);
      }

      const payload = {
        schoolId,
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: dto.isActive ?? false,
      };

      return this.academicYearRepository.create(manager, schoolId, payload);
    });
  }

  async getById(schoolId: string, id: string) {
    const year = await this.academicYearRepository.findById(id, schoolId);
    if (!year) throw new NotFoundError('Academic year not found in this school');
    return year;
  }

  async update(schoolId: string, id: string, dto: { name?: string; startDate?: string; endDate?: string; isActive?: boolean }) {
    return await this.dataSource.transaction(async (manager) => {
      // Atomic toggle for isActive state
      if (dto.isActive === true) {
        await this.academicYearRepository.deactivateAll(manager, schoolId, id);
      }

      const updatedYear = await this.academicYearRepository.update(manager, id, schoolId, dto);
      if (!updatedYear) throw new NotFoundError('Academic year not found');
      return updatedYear;
    });
  }
}