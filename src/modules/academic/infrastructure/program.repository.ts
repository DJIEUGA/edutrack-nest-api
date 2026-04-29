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
}
