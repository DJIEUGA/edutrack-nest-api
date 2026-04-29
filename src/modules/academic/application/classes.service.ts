import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { ClassEntity } from '../domain/class.entity';
import { ClassRepository } from '../infrastructure/class.repository';
import { AcademicYearsService } from './academic-years.service';

@Injectable()
export class ClassesService {
  constructor(
    private readonly classes: ClassRepository,
    private readonly years: AcademicYearsService,
  ) {}

  list(schoolId: string, academicYearId?: string): Promise<ClassEntity[]> {
    return this.classes.list(schoolId, academicYearId);
  }

  async getById(schoolId: string, id: string): Promise<ClassEntity> {
    const cls = await this.classes.findById(id);
    if (!cls || cls.schoolId !== schoolId) throw new NotFoundError('Class not found', { id });
    return cls;
  }

  async create(input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    programId?: string;
    specialtyId?: string;
    level?: number;
  }): Promise<ClassEntity> {
    await this.years.getById(input.schoolId, input.academicYearId); // membership check
    const existing = await this.classes.findByName(input.schoolId, input.academicYearId, input.name);
    if (existing) {
      throw new ConflictError('Class name already used in this academic year', {
        name: input.name,
      });
    }
    return this.classes.create({
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name: input.name,
      programId: input.programId ?? null,
      specialtyId: input.specialtyId ?? null,
      level: input.level ?? null,
    });
  }
}
