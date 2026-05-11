import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AcademicYear } from '../domain/academic-year.entity';

@Injectable()
export class AcademicYearRepository {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly repo: Repository<AcademicYear>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string, schoolId: string): Promise<AcademicYear | null> {
    const [year] = await this.dataSource.query(
      `SELECT id, name, start_date as "startDate", end_date as "endDate", is_active as "isActive" 
       FROM academic_years 
       WHERE id = $1 AND school_id = $2`,
      [id, schoolId],
    );
    return year;
  }

  findActive(schoolId: string): Promise<AcademicYear | null> {
    return this.dataSource.query('SELECT id, name, start_date as "startDate", end_date as "endDate", is_active as "isActive" FROM academic_years WHERE school_id = $1 AND is_active = TRUE', [schoolId])
  }

  list(schoolId: string): Promise<AcademicYear[]> {
    return this.repo.find({ where: { schoolId }, order: { startDate: 'DESC' } });
  }

  /**
   * Creates a year. If isActive=true, deactivates any other active year for the school
   * inside the same transaction (one active year per school).
   */
  async create(manager: EntityManager, schoolId: string, dto: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }): Promise<AcademicYear> {
    const [year] = await manager.query(
      `INSERT INTO academic_years (school_id, name, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, start_date as "startDate", end_date as "endDate", is_active as "isActive"`,
      [schoolId, dto.name, dto.startDate, dto.endDate, dto.isActive ?? false],
    );
    return year;
  }

  async deactivateAll(manager: EntityManager, schoolId: string, excludeId?: string): Promise<void> {
    let query = 'UPDATE academic_years SET is_active = false WHERE school_id = $1';
    const params = [schoolId];
    if (excludeId) {
      query += ' AND id != $2';
      params.push(excludeId);
    }
    await manager.query(query, params);
  }

  async update(
    manager: EntityManager,
    id: string,
    schoolId: string,
    dto: Partial<{ name: string; startDate: string; endDate: string; isActive: boolean }>,
  ): Promise<AcademicYear | null> {
    const [year] = await manager.query(
      `UPDATE academic_years 
       SET name = COALESCE($1, name),
           start_date = COALESCE($2, start_date),
           end_date = COALESCE($3, end_date),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND school_id = $6
       RETURNING id, name, start_date as "startDate", end_date as "endDate", is_active as "isActive"`,
      [dto.name, dto.startDate, dto.endDate, dto.isActive, id, schoolId],
    );
    return year;
  }
}
