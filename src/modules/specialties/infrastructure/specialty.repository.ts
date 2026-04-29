import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialty } from '../domain/specialty.entity';

@Injectable()
export class SpecialtyRepository {
  constructor(
    @InjectRepository(Specialty)
    private readonly repo: Repository<Specialty>,
  ) {}

  list(schoolId: string, programId?: string): Promise<Specialty[]> {
    return this.repo.find({
      where: programId ? { schoolId, programId } : { schoolId },
      order: { name: 'ASC' },
    });
  }

  findById(id: string): Promise<Specialty | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(schoolId: string, code: string): Promise<Specialty | null> {
    return this.repo.findOne({ where: { schoolId, code } });
  }

  create(input: {
    schoolId: string;
    programId: string;
    code: string;
    name: string;
  }): Promise<Specialty> {
    return this.repo.save(this.repo.create(input));
  }
}