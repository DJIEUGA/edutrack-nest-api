import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program } from '../domain/program.entity';

@Injectable()
export class ProgramRepository {
  constructor(
    @InjectRepository(Program)
    private readonly repo: Repository<Program>,
  ) {}

  list(schoolId: string): Promise<Program[]> {
    return this.repo.find({ where: { schoolId }, order: { name: 'ASC' } });
  }

  findByCode(schoolId: string, code: string): Promise<Program | null> {
    return this.repo.findOne({ where: { schoolId, code } });
  }

  create(input: {
    schoolId: string;
    code: string;
    name: string;
    durationYears: number;
    departmentId?: string | null;
  }): Promise<Program> {
    return this.repo.save(this.repo.create(input));
  }

  async update(id: string, schoolId: string, patch: {
    code?: string;
    name?: string;
    durationYears?: number;
    departmentId?: string | null;
  }): Promise<Program | null> {
    await this.repo.update({ id, schoolId }, patch);
    return this.repo.findOne({ where: { id, schoolId } });
  }

  async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }
}
