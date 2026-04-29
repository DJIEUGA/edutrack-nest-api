import { Injectable } from '@nestjs/common';
import { ConflictError } from '@common/errors/domain.errors';
import { ProgramLevel } from '../domain/program-level.entity';
import { ProgramLevelRepository } from '../infrastructure/program-level.repository';

@Injectable()
export class ProgramLevelsService {
  constructor(private readonly levels: ProgramLevelRepository) {}

  listByProgram(programId: string): Promise<ProgramLevel[]> {
    return this.levels.listByProgram(programId);
  }

  async create(input: {
    schoolId: string;
    programId: string;
    level: number;
    name: string;
  }): Promise<ProgramLevel> {
    const existing = await this.levels.findByLevel(input.programId, input.level);
    if (existing) {
      throw new ConflictError('Level already defined for this program', { level: input.level });
    }
    return this.levels.create(input);
  }
}