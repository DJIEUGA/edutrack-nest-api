import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramLevel } from '../domain/program-level.entity';

@Injectable()
export class ProgramLevelRepository {
  constructor(
    @InjectRepository(ProgramLevel)
    private readonly repo: Repository<ProgramLevel>,
  ) {}

  listByProgram(programId: string): Promise<ProgramLevel[]> {
    return this.repo.find({ where: { programId }, order: { level: 'ASC' } });
  }

  findByLevel(programId: string, level: number): Promise<ProgramLevel | null> {
    return this.repo.findOne({ where: { programId, level } });
  }

  create(input: {
    schoolId: string;
    programId: string;
    level: number;
    name: string;
  }): Promise<ProgramLevel> {
    return this.repo.save(this.repo.create(input));
  }
}