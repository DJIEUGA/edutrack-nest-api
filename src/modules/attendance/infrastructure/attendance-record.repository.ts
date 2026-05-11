import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from '../domain/attendance-record.entity';

@Injectable()
export class AttendanceRecordRepository {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly repo: Repository<AttendanceRecord>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<AttendanceRecord | null> {
    return this.repo.findOne({ where: { id } });
  }

  findBySessionAndStudent(sessionId: string, studentId: string): Promise<AttendanceRecord | null> {
    return this.repo.findOne({ where: { sessionId, studentId } });
  }

  async listBySession(schoolId: string, sessionId: string) {
    return this.dataSource.query(
      `SELECT ar.id, ar.status, ar.marked_at as "markedAt",
              s.matric_no as "matricNo", p.full_name as "studentName"
       FROM attendance_records ar
       JOIN students s ON ar.student_id = s.id
       JOIN profiles p ON s.user_id = p.id
       WHERE ar.session_id = $1 AND ar.school_id = $2`,
      [sessionId, schoolId],
    );
  }

  async listByStudent(schoolId: string, studentId: string) {
    return this.dataSource.query(
      `SELECT 
         ar.id, ar.status, ar.marked_at as "markedAt",
         s.scheduled_date as "sessionDate",
         c.code as "courseCode", c.title as "courseTitle"
       FROM attendance_records ar
       JOIN sessions s ON ar.session_id = s.id
       JOIN course_assignments ca ON s.course_assignment_id = ca.id
       JOIN courses c ON ca.course_id = c.id
       WHERE ar.student_id = $1 AND ar.school_id = $2
       ORDER BY s.scheduled_date DESC`,
      [studentId, schoolId],
    );
  }

  async upsert(
    manager: EntityManager,
    data: {
      schoolId: string;
      sessionId: string;
      studentId: string;
      status: AttendanceStatus;
      markedBy: string;
    },
  ) {
    const [record] = await manager.query(
      `INSERT INTO attendance_records (school_id, session_id, student_id, status, marked_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id, student_id) DO UPDATE 
       SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = NOW()
       RETURNING id, student_id as "studentId", status`,
      [data.schoolId, data.sessionId, data.studentId, data.status, data.markedBy],
    );
    return record;
  }
}
