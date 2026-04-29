import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { Specialty } from '../domain/specialty.entity';
import { SpecialtyRepository } from '../infrastructure/specialty.repository';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly specialties: SpecialtyRepository) {}

  list(schoolId: string, programId?: string): Promise<Specialty[]> {
    return this.specialties.list(schoolId, programId);
  }

  async getById(schoolId: string, id: string): Promise<Specialty> {
    const specialty = await this.specialties.findById(id);
    if (!specialty || specialty.schoolId !== schoolId) {
      throw new NotFoundError('Specialty not found', { id });
    }
    return specialty;
  }

  async create(input: {
    schoolId: string;
    programId: string;
    code: string;
    name: string;
  }): Promise<Specialty> {
    const existing = await this.specialties.findByCode(input.schoolId, input.code);
    if (existing) throw new ConflictError('Specialty code already in use', { code: input.code });
    return this.specialties.create(input);
  }
}
