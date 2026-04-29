import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../domain/department.entity';

@Injectable()
export class DepartmentRepository {
  constructor(
    @InjectRepository(Department)
    private readonly repo: Repository<Department>,
  ) {}

  list(schoolId: string): Promise<Department[]> {
    return this.repo.find({ where: { schoolId }, order: { name: 'ASC' } });
  }

  findByCode(schoolId: string, code: string): Promise<Department | null> {
    return this.repo.findOne({ where: { schoolId, code } });
  }

  create(input: { schoolId: string; code: string; name: string }): Promise<Department> {
    return this.repo.save(this.repo.create(input));
  }
}
