import { Injectable } from '@nestjs/common';
import { ConflictError } from '@common/errors/domain.errors';
import { Department } from '../domain/department.entity';
import { DepartmentRepository } from '../infrastructure/department.repository';

@Injectable()
export class DepartmentsService {
  constructor(private readonly departments: DepartmentRepository) {}

  list(schoolId: string): Promise<Department[]> {
    return this.departments.list(schoolId);
  }

  async create(input: { schoolId: string; code: string; name: string }): Promise<Department> {
    const existing = await this.departments.findByCode(input.schoolId, input.code);
    if (existing) throw new ConflictError('Department code already in use', { code: input.code });
    return this.departments.create(input);
  }
}
