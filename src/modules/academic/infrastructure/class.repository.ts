import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClassEntity } from '../domain/class.entity';

@Injectable()
export class ClassRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  list(schoolId: string, academicYearId?: string): Promise<ClassEntity[]> {
    return this.repo.find({
      where: academicYearId ? { schoolId, academicYearId } : { schoolId },
      order: { name: 'ASC' },
    });
  }

  findById(id: string): Promise<ClassEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(
    schoolId: string,
    academicYearId: string,
    name: string,
  ): Promise<ClassEntity | null> {
    return this.repo.findOne({ where: { schoolId, academicYearId, name } });
  }

  findChildren(parentClassId: string): Promise<ClassEntity[]> {
    return this.repo.find({ where: { parentClassId }, order: { name: 'ASC' } });
  }

  countStudents(classId: string): Promise<number> {
    return this.dataSource
      .query<Array<{ count: string }>>(
        'SELECT COUNT(*)::int as count FROM students WHERE class_id = $1',
        [classId],
      )
      .then((rows) => Number(rows[0]?.count ?? 0));
  }

  getStudentsSortedByName(classId: string): Promise<Array<{ id: string; fullName: string }>> {
    return this.dataSource.query(
      `SELECT s.id, COALESCE(p.full_name, s.matric_no, '') AS "fullName"
       FROM students s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN profiles p ON p.id = u.id
       WHERE s.class_id = $1
       ORDER BY COALESCE(p.full_name, s.matric_no, '') ASC, s.id ASC`,
      [classId],
    );
  }

  create(input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    programId?: string | null;
    specialtyId?: string | null;
    level?: number | null;
    maxCapacity?: number | null;
    parentClassId?: string | null;
  }): Promise<ClassEntity> {
    return this.repo.save(this.repo.create(input));
  }

  async update(id: string, schoolId: string, patch: {
    name?: string;
    programId?: string | null;
    level?: number | null;
    maxCapacity?: number | null;
  }): Promise<ClassEntity | null> {
    await this.repo.update({ id, schoolId }, patch);
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }
}
