import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { Program } from '../domain/program.entity';
import { ProgramRepository } from '../infrastructure/program.repository';

@Injectable()
export class ProgramsService {
  constructor(private readonly programs: ProgramRepository) {}

  list(schoolId: string): Promise<Program[]> {
    return this.programs.list(schoolId);
  }

  async create(input: {
    schoolId: string;
    code: string;
    name: string;
    durationYears: number;
    departmentId?: string;
  }): Promise<Program> {
    const existing = await this.programs.findByCode(input.schoolId, input.code);
    if (existing) throw new ConflictError('Program code already in use', { code: input.code });
    return this.programs.create({
      schoolId: input.schoolId,
      code: input.code,
      name: input.name,
      durationYears: input.durationYears,
      departmentId: input.departmentId ?? null,
    });
  }

  async update(schoolId: string, programId: string, patch: {
    code?: string;
    name?: string;
    durationYears?: number;
    departmentId?: string | null;
  }): Promise<Program> {
    const updated = await this.programs.update(programId, schoolId, patch);
    if (!updated) throw new NotFoundError('Program not found');
    return updated;
  }

  async delete(schoolId: string, programId: string): Promise<void> {
    const deleted = await this.programs.delete(programId, schoolId);
    if (!deleted) throw new NotFoundError('Program not found');
  }
}
