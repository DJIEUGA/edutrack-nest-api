import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Department } from '../domain/department.entity';

@Injectable()
export class DepartmentRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(schoolId: string): Promise<Department[]> {
    return this.dataSource.query(
      'SELECT id, school_id as "schoolId", code, name FROM departments WHERE school_id = $1 ORDER BY name ASC',
      [schoolId],
    );
  }

  async findByCode(schoolId: string, code: string): Promise<Department | null> {
    const [dept] = await this.dataSource.query(
      'SELECT id, school_id as "schoolId", code, name FROM departments WHERE school_id = $1 AND code = $2',
      [schoolId, code],
    );
    return dept || null;
  }

  async create(schoolId: string, dto: { code: string; name: string }): Promise<Department> {
    const [dept] = await this.dataSource.query(
      `INSERT INTO departments (school_id, code, name) VALUES ($1, $2, $3) 
       RETURNING id, school_id as "schoolId", code, name`,
      [schoolId, dto.code.toUpperCase(), dto.name],
    );
    return dept;
  }

  async update(id: string, schoolId: string, dto: { name?: string; code?: string }): Promise<Department | null> {
    const [dept] = await this.dataSource.query(
      `UPDATE departments SET
       name = COALESCE($1, name),
       code = COALESCE($2, code),
       updated_at = NOW()
       WHERE id = $3 AND school_id = $4
       RETURNING id, school_id as "schoolId", code, name`,
      [dto.name, dto.code?.toUpperCase(), id, schoolId],
    );
    return dept || null;
  }

  async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'DELETE FROM departments WHERE id = $1 AND school_id = $2',
      [id, schoolId],
    );
    return result[1] > 0;
  }
}
