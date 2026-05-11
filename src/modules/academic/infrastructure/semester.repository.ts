import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semester } from '../domain/semester.entity';

@Injectable()
export class SemesterRepository {
  constructor(
    @InjectRepository(Semester)
    private readonly repo: Repository<Semester>,
  ) {}

  list(academicYearId: string): Promise<Semester[]> {
    return this.repo.find({ where: { academicYearId }, order: { startDate: 'ASC' } });
  }

  create(input: {
    academicYearId: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }): Promise<Semester> {
    const entity = this.repo.create(input);
    return this.repo.save(entity);
  }

  async update(id: string, patch: {
    name?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
  }): Promise<Semester | null> {
    await this.repo.update({ id }, patch);
    return this.repo.findOne({ where: { id } });
  }
}
