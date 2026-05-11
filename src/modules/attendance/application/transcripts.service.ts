import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class TranscriptsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Generates a verifiable data package for a student's transcript.
   */
  async getVerifiableRecord(schoolId: string, studentId: string) {
    const results = await this.dataSource.query(
      `SELECT 
         ay.name as "academicYear",
         c.code as "courseCode",
         c.title as "courseTitle",
         c.unit_load as "units",
         r.grade,
         r.score,
         (SELECT ROUND((COUNT(CASE WHEN status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2)
          FROM attendance_records 
          WHERE student_id = $2 AND session_id IN (
            SELECT id FROM sessions WHERE course_assignment_id IN (
              SELECT id FROM course_assignments WHERE course_id = c.id
            )
          )) as "attendanceRate"
       FROM academic_results r
       JOIN courses c ON r.course_id = c.id
       JOIN academic_years ay ON r.academic_year_id = ay.id
       WHERE r.student_id = $2 AND r.school_id = $1
       ORDER BY ay.start_date DESC, c.code ASC`,
      [schoolId, studentId],
    );

    return { studentId, records: results, generatedAt: new Date().toISOString() };
  }
}