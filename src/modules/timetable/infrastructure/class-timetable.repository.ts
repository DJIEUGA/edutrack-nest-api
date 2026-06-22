import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ClassWithDelegate {
  id: string;
  name: string;
  delegateStudentId: string | null;
  delegateName: string | null;
  delegateEmail: string | null;
  delegatePhone: string | null;
}

export interface ClassSlotRow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  venue: string | null;
  courseAssignmentId: string;
  courseCode: string;
  courseTitle: string;
  lecturerUserId: string;
  lecturerName: string | null;
  lecturerEmail: string | null;
  lecturerPhone: string | null;
}

@Injectable()
export class ClassTimetableRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findClassWithDelegate(schoolId: string, classId: string): Promise<ClassWithDelegate | null> {
    const [row] = await this.dataSource.query(
      `SELECT
         cl.id,
         cl.name,
         cl.delegate_student_id AS "delegateStudentId",
         dp.full_name           AS "delegateName",
         du.email               AS "delegateEmail",
         dp.phone               AS "delegatePhone"
       FROM classes cl
       LEFT JOIN students del ON del.id = cl.delegate_student_id
       LEFT JOIN users du     ON du.id  = del.user_id
       LEFT JOIN profiles dp  ON dp.id  = du.id
       WHERE cl.id = $1 AND cl.school_id = $2`,
      [classId, schoolId],
    );
    return row || null;
  }

  async findSlotsForClass(
    schoolId: string,
    classId: string,
    academicYearId?: string,
  ): Promise<ClassSlotRow[]> {
    return this.dataSource.query(
      `SELECT
         ts.id,
         ts.day_of_week           AS "dayOfWeek",
         ts.start_time            AS "startTime",
         ts.end_time              AS "endTime",
         ts.venue,
         ts.course_assignment_id  AS "courseAssignmentId",
         c.code                   AS "courseCode",
         c.title                  AS "courseTitle",
         ca.lecturer_user_id      AS "lecturerUserId",
         lp.full_name             AS "lecturerName",
         lu.email                 AS "lecturerEmail",
         lp.phone                 AS "lecturerPhone"
       FROM timetable_slots ts
       JOIN course_assignments ca ON ca.id = ts.course_assignment_id
       JOIN courses c             ON c.id  = ca.course_id
       LEFT JOIN users lu         ON lu.id = ca.lecturer_user_id
       LEFT JOIN profiles lp      ON lp.id = lu.id
       WHERE ts.school_id = $1
         AND ca.class_id  = $2
         AND ($3::uuid IS NULL OR ts.academic_year_id = $3)
       ORDER BY ts.day_of_week, ts.start_time`,
      [schoolId, classId, academicYearId || null],
    );
  }

  async verifyLecturerInClass(schoolId: string, classId: string, lecturerUserId: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT 1 FROM course_assignments
       WHERE school_id = $1 AND class_id = $2 AND lecturer_user_id = $3
       LIMIT 1`,
      [schoolId, classId, lecturerUserId],
    );
    return !!row;
  }

  async verifyStudentInClass(schoolId: string, classId: string, userId: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT 1 FROM students
       WHERE school_id = $1 AND class_id = $2 AND user_id = $3
       LIMIT 1`,
      [schoolId, classId, userId],
    );
    return !!row;
  }

  async verifyHodOverClass(schoolId: string, classId: string, userId: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT 1
       FROM course_assignments ca
       JOIN courses c     ON c.id = ca.course_id
       JOIN user_roles ur ON ur.department_id = c.department_id
       WHERE ca.school_id = $1
         AND ca.class_id  = $2
         AND ur.user_id   = $3
         AND ur.school_id = $1
         AND ur.role IN ('hod', 'director')
       LIMIT 1`,
      [schoolId, classId, userId],
    );
    return !!row;
  }

  async getCourseAssignment(courseAssignmentId: string, schoolId: string) {
    const [row] = await this.dataSource.query(
      `SELECT id, class_id AS "classId", lecturer_user_id AS "lecturerUserId"
       FROM course_assignments WHERE id = $1 AND school_id = $2`,
      [courseAssignmentId, schoolId],
    );
    return row || null;
  }

  async slotBelongsToClass(slotId: string, schoolId: string, classId: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT 1 FROM timetable_slots ts
       JOIN course_assignments ca ON ca.id = ts.course_assignment_id
       WHERE ts.id = $1 AND ts.school_id = $2 AND ca.class_id = $3
       LIMIT 1`,
      [slotId, schoolId, classId],
    );
    return !!row;
  }
}
