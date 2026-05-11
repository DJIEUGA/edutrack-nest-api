import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from '../domain/class.entity';

@Injectable()
export class ClassRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
  ) {}

  list(schoolId: string, academicYearId?: string): Promise<ClassEntity[]> {
    return this.repo.find({
      where: academicYearId ? { schoolId, academicYearId } : { schoolId },
      order: { name: 'ASC' },
    });
  }

  findById(id: string): Promise<ClassEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(
    schoolId: string,
    academicYearId: string,
    name: string,
  ): Promise<ClassEntity | null> {
    return this.repo.findOne({ where: { schoolId, academicYearId, name } });
  }

  create(input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    programId?: string | null;
    specialtyId?: string | null;
    level?: number | null;
  }): Promise<ClassEntity> {
    return this.repo.save(this.repo.create(input));
  }

  async update(id: string, schoolId: string, patch: {
    name?: string;
    programId?: string | null;
    level?: number | null;
  }): Promise<ClassEntity | null> {
    await this.repo.update({ id, schoolId }, patch);
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }
}
