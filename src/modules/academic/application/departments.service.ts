import { Injectable } from '@nestjs/common';
import { NotFoundError, ConflictError } from '@common/errors/domain.errors';
import { DepartmentRepository } from '../infrastructure/department.repository';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  async list(schoolId: string) {
    return this.departmentRepository.list(schoolId);
  }

  async create(schoolId: string, dto: { code: string; name: string }) {
    try {
      return await this.departmentRepository.create(schoolId, dto);
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictError('Department code already exists in this school');
      throw e;
    }
  }

  async update(schoolId: string, id: string, dto: { name?: string; code?: string }) {
    const dept = await this.departmentRepository.update(id, schoolId, dto);
    if (!dept) throw new NotFoundError('Department not found');
    return dept;
  }

  async delete(schoolId: string, id: string): Promise<void> {
    const deleted = await this.departmentRepository.delete(id, schoolId);
    if (!deleted) throw new NotFoundError('Department not found');
  }
}