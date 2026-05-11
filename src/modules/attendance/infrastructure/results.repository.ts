import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ResultsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Persists or updates an academic result within a transaction.
   */
  async upsertResult(
    manager: EntityManager,
    schoolId: string,
    academicYearId: string,
    courseId: string,
    studentId: string,
    score: number,
    grade: string,
    recordedBy: string,
  ) {
    const [result] = await manager.query(
      `INSERT INTO academic_results (school_id, academic_year_id, course_id, student_id, score, grade, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (academic_year_id, course_id, student_id) 
       DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade, updated_at = NOW()
       RETURNING id, student_id as "studentId", score, grade`,
      [schoolId, academicYearId, courseId, studentId, score, grade, recordedBy],
    );
    return result;
  }

  async findByStudent(studentId: string, academicYearId?: string) {
    return this.dataSource.query(
      `SELECT r.id, r.score, r.grade, c.code as "courseCode", c.title as "courseTitle", c.unit_load as "unitLoad"
       FROM academic_results r
       JOIN courses c ON r.course_id = c.id
       WHERE r.student_id = $1 AND ($2::uuid IS NULL OR r.academic_year_id = $2)
       ORDER BY c.code ASC`,
      [studentId, academicYearId || null],
    );
  }
}