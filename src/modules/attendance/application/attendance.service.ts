import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly attendanceRepository: AttendanceRecordRepository,
  ) {}

  async bulkMark(schoolId: string, sessionId: string, actorId: string, entries: { studentId: string; status: string }[]) {
    return await this.dataSource.transaction(async (manager) => {
      const results = [];
      for (const entry of entries) {
        const record = await this.attendanceRepository.upsert(manager, {
          schoolId,
          sessionId,
          studentId: entry.studentId,
          status: entry.status as any,
          markedBy: actorId,
        });
        results.push(record);
      }
      return results;
    });
  }

  async getSessionAttendance(schoolId: string, sessionId: string) {
    return this.attendanceRepository.listBySession(schoolId, sessionId);
  }

  async listByStudent(schoolId: string, studentId: string) {
    return this.attendanceRepository.listByStudent(schoolId, studentId);
  }

  async getSummary(schoolId: string, filters?: { academicYearId?: string; sessionId?: string }) {
    return this.dataSource.query(
      `SELECT
         s.id as "studentId",
         p.full_name as "fullName",
         s.matric_no as "matricNo",
         COUNT(ar.id)::int as "totalSessions",
         COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::int as "present",
         COUNT(CASE WHEN ar.status = 'late' THEN 1 END)::int as "late",
         COUNT(CASE WHEN ar.status = 'absent' THEN 1 END)::int as "absent",
         COUNT(CASE WHEN ar.status = 'excused' THEN 1 END)::int as "excused",
         ROUND(
           (COUNT(CASE WHEN ar.status IN ('present','late') THEN 1 END)::numeric
            / NULLIF(COUNT(ar.id), 0)) * 100, 2
         ) as "attendanceRate"
       FROM students s
       JOIN profiles p ON s.user_id = p.id
       LEFT JOIN attendance_records ar ON s.id = ar.student_id AND ar.school_id = $1
       LEFT JOIN sessions sess ON ar.session_id = sess.id
       WHERE s.school_id = $1
         AND ($2::uuid IS NULL OR sess.academic_year_id = $2)
         AND ($3::uuid IS NULL OR ar.session_id = $3)
       GROUP BY s.id, p.full_name, s.matric_no
       ORDER BY p.full_name ASC`,
      [schoolId, filters?.academicYearId || null, filters?.sessionId || null],
    );
  }

  async getStudentSummary(schoolId: string, studentId: string, academicYearId?: string) {
    const [row] = await this.dataSource.query(
      `SELECT
         s.id as "studentId",
         COUNT(ar.id)::int as "totalSessions",
         COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::int as "present",
         COUNT(CASE WHEN ar.status = 'late' THEN 1 END)::int as "late",
         COUNT(CASE WHEN ar.status = 'absent' THEN 1 END)::int as "absent",
         COUNT(CASE WHEN ar.status = 'excused' THEN 1 END)::int as "excused",
         ROUND(
           (COUNT(CASE WHEN ar.status IN ('present','late') THEN 1 END)::numeric
            / NULLIF(COUNT(ar.id), 0)) * 100, 2
         ) as "attendanceRate"
       FROM students s
       LEFT JOIN attendance_records ar ON s.id = ar.student_id AND ar.school_id = $1
       LEFT JOIN sessions sess ON ar.session_id = sess.id
       WHERE s.id = $2 AND s.school_id = $1
         AND ($3::uuid IS NULL OR sess.academic_year_id = $3)
       GROUP BY s.id`,
      [schoolId, studentId, academicYearId || null],
    );
    return row ?? {
      studentId,
      totalSessions: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      attendanceRate: null,
    };
  }
}