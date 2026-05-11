import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class StudentsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listBySchool(schoolId: string, status?: string) {
    return this.dataSource.query(
      `SELECT 
         s.id, s.school_id as "schoolId", s.matric_no as "matricNo", 
         s.class_id as "classId", s.status, s.rejection_reason as "rejectionReason",
         s.created_at as "appliedAt",
         json_build_object(
           'id', u.id,
           'fullName', p.full_name,
           'email', u.email,
           'avatarUrl', p.avatar_url
         ) as user
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN profiles p ON u.id = p.id
       WHERE s.school_id = $1
         AND ($2::text IS NULL OR s.status = $2)
       ORDER BY s.created_at DESC`,
      [schoolId, status || null],
    );
  }

  async search(schoolId: string, filters: { programId?: string; level?: number; status?: string; limit?: number; offset?: number }) {
    const { programId, level, status, limit = 50, offset = 0 } = filters;
    
    return this.dataSource.query(
      `SELECT 
         s.id, s.school_id as "schoolId", s.matric_no as "matricNo", 
         s.class_id as "classId", s.status, s.rejection_reason as "rejectionReason",
         s.created_at as "appliedAt",
         cl.name as "className", cl.level, cl.program_id as "programId",
         json_build_object(
           'id', u.id,
           'fullName', p.full_name,
           'email', u.email,
           'avatarUrl', p.avatar_url
         ) as user
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN profiles p ON u.id = p.id
       LEFT JOIN classes cl ON s.class_id = cl.id
       WHERE s.school_id = $1
         AND ($2::uuid IS NULL OR cl.program_id = $2)
         AND ($3::int IS NULL OR cl.level = $3)
         AND ($4::text IS NULL OR s.status = $4)
       ORDER BY p.full_name ASC
       LIMIT $5 OFFSET $6`,
      [schoolId, programId || null, level || null, status || null, limit, offset],
    );
  }

  async findById(studentId: string, schoolId: string) {
    const [row] = await this.dataSource.query(
      `SELECT 
         s.id, s.school_id as "schoolId", s.matric_no as "matricNo", 
         s.class_id as "classId", s.status, s.rejection_reason as "rejectionReason",
         s.created_at as "appliedAt",
         json_build_object(
           'id', u.id,
           'fullName', p.full_name,
           'email', u.email,
           'avatarUrl', p.avatar_url
         ) as user
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN profiles p ON u.id = p.id
       WHERE s.id = $1 AND s.school_id = $2`,
      [studentId, schoolId],
    );
    return row;
  }

  async findByMatricNo(schoolId: string, matricNo: string) {
    const [row] = await this.dataSource.query(
      'SELECT id FROM students WHERE school_id = $1 AND matric_no = $2',
      [schoolId, matricNo],
    );
    return row;
  }

  async findByUserId(schoolId: string, userId: string) {
    const [row] = await this.dataSource.query(
      'SELECT id FROM students WHERE school_id = $1 AND user_id = $2',
      [schoolId, userId],
    );
    return row;
  }

  async create(schoolId: string, dto: { userId: string; matricNo?: string; classId?: string }) {
    const [student] = await this.dataSource.query(
      `INSERT INTO students (school_id, user_id, matric_no, class_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [schoolId, dto.userId, dto.matricNo, dto.classId],
    );
    return student.id;
  }

  async delete(studentId: string, schoolId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'DELETE FROM students WHERE id = $1 AND school_id = $2',
      [studentId, schoolId],
    );
    return result[1] > 0;
  }

  async findByIdInTransaction(manager: EntityManager, studentId: string, schoolId: string) {
    const [student] = await manager.query(
      'SELECT id FROM students WHERE id = $1 AND school_id = $2',
      [studentId, schoolId],
    );
    return student;
  }

  async updateStatus(manager: EntityManager, studentId: string, status: string, reason?: string) {
    await manager.query(
      `UPDATE students 
       SET status = $1, rejection_reason = $2, updated_at = NOW() 
       WHERE id = $3`,
      [status, reason || null, studentId],
    );
  }

  async findRawById(manager: EntityManager, studentId: string) {
    const [updated] = await manager.query(
      'SELECT * FROM students WHERE id = $1',
      [studentId],
    );
    return updated;
  }
}