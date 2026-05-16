import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictError, NotFoundError, ValidationError } from '@common/errors/domain.errors';
import { ClassEntity } from '../domain/class.entity';
import { ClassEnrollmentRequest } from '../domain/class-enrollment-request.entity';
import { ClassRepository } from '../infrastructure/class.repository';
import { ClassEnrollmentRequestRepository } from '../infrastructure/class-enrollment-request.repository';
import { ClassTransferLogRepository } from '../infrastructure/class-transfer-log.repository';
import { AcademicYearsService } from './academic-years.service';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    private readonly classes: ClassRepository,
    private readonly years: AcademicYearsService,
    private readonly enrollmentRequests: ClassEnrollmentRequestRepository,
    private readonly transferLogs: ClassTransferLogRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  list(schoolId: string, academicYearId?: string): Promise<ClassEntity[]> {
    return this.classes.list(schoolId, academicYearId);
  }

  async getById(schoolId: string, id: string): Promise<ClassEntity> {
    const cls = await this.classes.findById(id);
    if (!cls || cls.schoolId !== schoolId) throw new NotFoundError('Class not found', { id });
    return cls;
  }

  async create(input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    programId?: string;
    specialtyId?: string;
    level?: number;
    maxCapacity?: number;
  }): Promise<ClassEntity> {
    await this.years.getById(input.schoolId, input.academicYearId);
    const existing = await this.classes.findByName(input.schoolId, input.academicYearId, input.name);
    if (existing) {
      throw new ConflictError('Class name already used in this academic year', { name: input.name });
    }
    return this.classes.create({
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name: input.name,
      programId: input.programId ?? null,
      specialtyId: input.specialtyId ?? null,
      level: input.level ?? null,
      maxCapacity: input.maxCapacity ?? null,
    });
  }

  async update(schoolId: string, classId: string, patch: {
    name?: string;
    programId?: string | null;
    level?: number | null;
    maxCapacity?: number | null;
  }): Promise<ClassEntity> {
    const updated = await this.classes.update(classId, schoolId, patch);
    if (!updated) throw new NotFoundError('Class not found', { classId });
    return updated;
  }

  async delete(schoolId: string, classId: string): Promise<void> {
    const cls = await this.classes.findById(classId);
    if (!cls || cls.schoolId !== schoolId) throw new NotFoundError('Class not found', { classId });
    if (cls.isGroup) {
      const children = await this.classes.findChildren(classId);
      if (children.length > 0) {
        throw new ConflictError('Cannot delete a group class that has sub-classes', { classId });
      }
    }
    const deleted = await this.classes.delete(classId, schoolId);
    if (!deleted) throw new NotFoundError('Class not found', { classId });
  }

  // ── Capacity ───────────────────────────────────────────────────────────────

  async getCapacity(schoolId: string, classId: string): Promise<{
    maxCapacity: number | null;
    currentCount: number;
    atCapacity: boolean;
  }> {
    const cls = await this.getById(schoolId, classId);
    const currentCount = await this.classes.countStudents(classId);
    return {
      maxCapacity: cls.maxCapacity ?? null,
      currentCount,
      atCapacity: cls.maxCapacity != null && currentCount >= cls.maxCapacity,
    };
  }

  // ── Split ──────────────────────────────────────────────────────────────────

  async splitClass(
    schoolId: string,
    classId: string,
    actorId: string,
  ): Promise<{ classA: ClassEntity; classB: ClassEntity; movedToA: number; movedToB: number }> {
    const cls = await this.classes.findById(classId);
    if (!cls || cls.schoolId !== schoolId) throw new NotFoundError('Class not found', { classId });
    if (cls.isGroup) throw new ConflictError('Class has already been split', { classId });

    const existing = await this.classes.findChildren(classId);
    if (existing.length > 0) throw new ConflictError('Class already has sub-classes', { classId });

    const nameA = cls.name + 'A';
    const nameB = cls.name + 'B';

    const [conflictA, conflictB] = await Promise.all([
      this.classes.findByName(schoolId, cls.academicYearId, nameA),
      this.classes.findByName(schoolId, cls.academicYearId, nameB),
    ]);
    const conflicts = [conflictA && nameA, conflictB && nameB].filter(Boolean);
    if (conflicts.length > 0) {
      throw new ConflictError(`Sub-class names already in use: ${conflicts.join(', ')}`, {});
    }

    const students = await this.classes.getStudentsSortedByName(classId);
    const mid = Math.ceil(students.length / 2);
    const firstHalf = students.slice(0, mid);
    const secondHalf = students.slice(mid);

    const result = await this.dataSource.transaction(async (manager) => {
      // Create sub-class A (inherits all course assignments and timetable slots)
      const [rawA] = await manager.query<ClassEntity[]>(
        `INSERT INTO classes (school_id, academic_year_id, name, program_id, specialty_id, level,
                              max_capacity, parent_class_id, is_group, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
         RETURNING *`,
        [schoolId, cls.academicYearId, nameA, cls.programId, cls.specialtyId, cls.level, cls.maxCapacity, classId],
      );

      // Create sub-class B (no course assignments; admin sets them up manually)
      const [rawB] = await manager.query<ClassEntity[]>(
        `INSERT INTO classes (school_id, academic_year_id, name, program_id, specialty_id, level,
                              max_capacity, parent_class_id, is_group, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
         RETURNING *`,
        [schoolId, cls.academicYearId, nameB, cls.programId, cls.specialtyId, cls.level, cls.maxCapacity, classId],
      );

      // Reassign all course_assignments (and thus timetable_slots and sessions) to class A
      await manager.query(
        `UPDATE course_assignments SET class_id = $1 WHERE class_id = $2 AND school_id = $3`,
        [rawA.id, classId, schoolId],
      );

      // Move first-half students to A
      if (firstHalf.length > 0) {
        const ids = firstHalf.map((s) => s.id);
        await manager.query(
          `UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
          [rawA.id, ids],
        );
        for (const student of firstHalf) {
          await manager.query(
            `INSERT INTO class_transfer_logs
               (school_id, student_id, from_class_id, to_class_id, reason, transferred_by, transferred_at)
             VALUES ($1, $2, $3, $4, 'Class auto-split (first half)', $5, NOW())`,
            [schoolId, student.id, classId, rawA.id, actorId],
          );
        }
      }

      // Move second-half students to B
      if (secondHalf.length > 0) {
        const ids = secondHalf.map((s) => s.id);
        await manager.query(
          `UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
          [rawB.id, ids],
        );
        for (const student of secondHalf) {
          await manager.query(
            `INSERT INTO class_transfer_logs
               (school_id, student_id, from_class_id, to_class_id, reason, transferred_by, transferred_at)
             VALUES ($1, $2, $3, $4, 'Class auto-split (second half)', $5, NOW())`,
            [schoolId, student.id, classId, rawB.id, actorId],
          );
        }
      }

      // Mark parent as group
      await manager.query(
        `UPDATE classes SET is_group = true, split_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [classId],
      );

      // Audit log
      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, 'class:split', 'class', $3, $4)`,
        [
          actorId,
          schoolId,
          classId,
          JSON.stringify({
            classAId: rawA.id,
            classBId: rawB.id,
            firstHalfCount: firstHalf.length,
            secondHalfCount: secondHalf.length,
          }),
        ],
      );

      return { classA: rawA as ClassEntity, classB: rawB as ClassEntity };
    });

    return {
      classA: result.classA,
      classB: result.classB,
      movedToA: firstHalf.length,
      movedToB: secondHalf.length,
    };
  }

  // ── Class students view (for admins and lecturers) ─────────────────────────

  async getClassStudents(schoolId: string, classId: string): Promise<unknown[]> {
    const cls = await this.classes.findById(classId);
    if (!cls || cls.schoolId !== schoolId) throw new NotFoundError('Class not found', { classId });

    return this.dataSource.query(
      `SELECT
         s.id, s.matric_no AS "matricNo", s.status,
         json_build_object(
           'id', u.id,
           'fullName', p.full_name,
           'email', u.email,
           'avatarUrl', p.avatar_url
         ) AS user
       FROM students s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN profiles p ON p.id = u.id
       WHERE s.class_id = $1
       ORDER BY COALESCE(p.full_name, s.matric_no, '') ASC`,
      [classId],
    );
  }

  // ── Enrollment requests ────────────────────────────────────────────────────

  async requestEnrollment(input: {
    schoolId: string;
    studentId: string;
    classId: string;
    requestedBy: string;
    notes?: string;
  }): Promise<{ request: ClassEnrollmentRequest; warning?: string }> {
    const cls = await this.classes.findById(input.classId);
    if (!cls || cls.schoolId !== input.schoolId) {
      throw new NotFoundError('Class not found', { classId: input.classId });
    }
    if (cls.isGroup) {
      throw new ValidationError('Cannot enroll into a group class — choose one of its sub-classes', {
        classId: input.classId,
      });
    }

    const duplicate = await this.enrollmentRequests.findPendingByStudentAndClass(
      input.studentId,
      input.classId,
    );
    if (duplicate) {
      throw new ConflictError('Student already has a pending enrollment request for this class', {
        requestId: duplicate.id,
      });
    }

    const request = await this.enrollmentRequests.create(input);

    const currentCount = await this.classes.countStudents(input.classId);
    const warning =
      cls.maxCapacity != null && currentCount >= cls.maxCapacity
        ? `Class is at capacity (${currentCount}/${cls.maxCapacity}). An admin must override to approve.`
        : undefined;

    return { request, warning };
  }

  async listEnrollmentRequests(
    schoolId: string,
    classId: string,
    status?: 'pending' | 'approved' | 'rejected',
  ): Promise<ClassEnrollmentRequest[]> {
    const cls = await this.classes.findById(classId);
    if (!cls || cls.schoolId !== schoolId) throw new NotFoundError('Class not found', { classId });
    return this.enrollmentRequests.listByClass(schoolId, classId, status);
  }

  async approveEnrollment(
    schoolId: string,
    requestId: string,
    reviewedBy: string,
    overrideCap = false,
  ): Promise<{ request: ClassEnrollmentRequest; splitTriggered: boolean }> {
    const req = await this.enrollmentRequests.findById(requestId);
    if (!req || req.schoolId !== schoolId) throw new NotFoundError('Enrollment request not found', { requestId });
    if (req.status !== 'pending') {
      throw new ConflictError('Request has already been reviewed', { status: req.status });
    }

    const cls = await this.classes.findById(req.classId);
    if (!cls) throw new NotFoundError('Class not found', { classId: req.classId });

    const currentCount = await this.classes.countStudents(req.classId);
    if (cls.maxCapacity != null && currentCount >= cls.maxCapacity && !overrideCap) {
      throw new ConflictError(
        `Class is at capacity (${currentCount}/${cls.maxCapacity}). Pass overrideCap=true to proceed.`,
        { currentCount, maxCapacity: cls.maxCapacity },
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // Assign student to class
      await manager.query(
        `UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
        [req.classId, req.studentId, schoolId],
      );

      // Record transfer
      const [existingStudent] = await manager.query<Array<{ class_id: string | null }>>(
        `SELECT class_id FROM students WHERE id = $1`,
        [req.studentId],
      );
      await manager.query(
        `INSERT INTO class_transfer_logs
           (school_id, student_id, from_class_id, to_class_id, reason, transferred_by, transferred_at)
         VALUES ($1, $2, $3, $4, 'Enrollment approved', $5, NOW())`,
        [schoolId, req.studentId, existingStudent?.class_id ?? null, req.classId, reviewedBy],
      );

      // Audit log
      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, 'enrollment:approved', 'class_enrollment_request', $3, $4)`,
        [reviewedBy, schoolId, requestId, JSON.stringify({ classId: req.classId, studentId: req.studentId })],
      );
    });

    const updated = await this.enrollmentRequests.approve(requestId, reviewedBy);

    // Auto-split if capacity is now reached
    let splitTriggered = false;
    if (cls.maxCapacity != null && !cls.isGroup) {
      const newCount = await this.classes.countStudents(req.classId);
      const children = await this.classes.findChildren(req.classId);
      if (newCount >= cls.maxCapacity && children.length === 0) {
        try {
          await this.splitClass(schoolId, req.classId, reviewedBy);
          splitTriggered = true;
        } catch (err) {
          this.logger.error(`Auto-split failed for class ${req.classId}: ${(err as Error).message}`);
        }
      }
    }

    return { request: updated!, splitTriggered };
  }

  async rejectEnrollment(
    schoolId: string,
    requestId: string,
    reviewedBy: string,
    notes?: string,
  ): Promise<ClassEnrollmentRequest> {
    const req = await this.enrollmentRequests.findById(requestId);
    if (!req || req.schoolId !== schoolId) throw new NotFoundError('Enrollment request not found', { requestId });
    if (req.status !== 'pending') {
      throw new ConflictError('Request has already been reviewed', { status: req.status });
    }

    const updated = await this.enrollmentRequests.reject(requestId, reviewedBy, notes);
    return updated!;
  }

  // ── Direct class transfer (admin action) ───────────────────────────────────

  async transferStudent(input: {
    schoolId: string;
    studentId: string;
    toClassId: string;
    actorId: string;
    reason?: string;
  }): Promise<void> {
    const targetClass = await this.classes.findById(input.toClassId);
    if (!targetClass || targetClass.schoolId !== input.schoolId) {
      throw new NotFoundError('Target class not found', { classId: input.toClassId });
    }
    if (targetClass.isGroup) {
      throw new ValidationError('Cannot transfer a student into a group class — choose a sub-class', {
        classId: input.toClassId,
      });
    }

    const [student] = await this.dataSource.query<Array<{ class_id: string | null }>>(
      `SELECT class_id FROM students WHERE id = $1 AND school_id = $2`,
      [input.studentId, input.schoolId],
    );
    if (!student) throw new NotFoundError('Student not found', { studentId: input.studentId });

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
        [input.toClassId, input.studentId, input.schoolId],
      );

      await manager.query(
        `INSERT INTO class_transfer_logs
           (school_id, student_id, from_class_id, to_class_id, reason, transferred_by, transferred_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [input.schoolId, input.studentId, student.class_id, input.toClassId, input.reason ?? null, input.actorId],
      );

      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, 'student:transfer', 'student', $3, $4)`,
        [
          input.actorId,
          input.schoolId,
          input.studentId,
          JSON.stringify({ fromClassId: student.class_id, toClassId: input.toClassId, reason: input.reason }),
        ],
      );
    });

    // Auto-split check on target class
    if (targetClass.maxCapacity != null && !targetClass.isGroup) {
      const newCount = await this.classes.countStudents(input.toClassId);
      const children = await this.classes.findChildren(input.toClassId);
      if (newCount >= targetClass.maxCapacity && children.length === 0) {
        try {
          await this.splitClass(input.schoolId, input.toClassId, input.actorId);
        } catch (err) {
          this.logger.error(`Auto-split failed for class ${input.toClassId}: ${(err as Error).message}`);
        }
      }
    }
  }

  // ── Student's own class overview ───────────────────────────────────────────

  async getMyClassOverview(schoolId: string, userId: string): Promise<{
    class: ClassEntity;
    classmates: unknown[];
    timetable: unknown[];
    activeSessions: unknown[];
    courses: unknown[];
    myAttendance: unknown[];
    myGrades: unknown[];
  } | null> {
    const [studentRow] = await this.dataSource.query<Array<{ id: string; class_id: string | null }>>(
      `SELECT id, class_id FROM students WHERE user_id = $1 AND school_id = $2`,
      [userId, schoolId],
    );
    if (!studentRow?.class_id) return null;

    const cls = await this.classes.findById(studentRow.class_id);
    if (!cls) return null;

    const [classmates, timetable, activeSessions, courses, myAttendance, myGrades] = await Promise.all([
      // Classmates
      this.dataSource.query(
        `SELECT s.id, s.matric_no AS "matricNo",
                p.full_name AS "fullName", p.avatar_url AS "avatarUrl"
         FROM students s
         LEFT JOIN users u ON s.user_id = u.id
         LEFT JOIN profiles p ON p.id = u.id
         WHERE s.class_id = $1 AND s.id != $2
         ORDER BY COALESCE(p.full_name, '') ASC`,
        [studentRow.class_id, studentRow.id],
      ),

      // Timetable
      this.dataSource.query(
        `SELECT ts.id, ts.day_of_week AS "dayOfWeek", ts.start_time AS "startTime",
                ts.end_time AS "endTime", ts.venue,
                c.code AS "courseCode", c.title AS "courseTitle",
                p.full_name AS "lecturerName"
         FROM timetable_slots ts
         JOIN course_assignments ca ON ts.course_assignment_id = ca.id
         JOIN courses c ON ca.course_id = c.id
         LEFT JOIN users u ON ca.lecturer_user_id = u.id
         LEFT JOIN profiles p ON p.id = u.id
         WHERE ca.class_id = $1
         ORDER BY ts.day_of_week, ts.start_time`,
        [studentRow.class_id],
      ),

      // Active sessions
      this.dataSource.query(
        `SELECT s.id, s.scheduled_date AS "scheduledDate", s.status,
                s.actual_start AS "actualStart",
                c.code AS "courseCode", c.title AS "courseTitle"
         FROM sessions s
         JOIN course_assignments ca ON s.course_assignment_id = ca.id
         JOIN courses c ON ca.course_id = c.id
         WHERE ca.class_id = $1 AND s.status IN ('scheduled', 'in_progress')
         ORDER BY s.scheduled_date ASC`,
        [studentRow.class_id],
      ),

      // Courses with lecturers
      this.dataSource.query(
        `SELECT c.id, c.code, c.title, c.unit_load AS "unitLoad",
                u.id AS "lecturerId",
                p.full_name AS "lecturerName", p.avatar_url AS "lecturerAvatarUrl"
         FROM course_assignments ca
         JOIN courses c ON ca.course_id = c.id
         LEFT JOIN users u ON ca.lecturer_user_id = u.id
         LEFT JOIN profiles p ON p.id = u.id
         WHERE ca.class_id = $1 AND ca.school_id = $2`,
        [studentRow.class_id, schoolId],
      ),

      // My attendance
      this.dataSource.query(
        `SELECT ar.session_id AS "sessionId", ar.status, ar.marked_at AS "markedAt",
                c.code AS "courseCode", c.title AS "courseTitle"
         FROM attendance_records ar
         JOIN sessions s ON ar.session_id = s.id
         JOIN course_assignments ca ON s.course_assignment_id = ca.id
         JOIN courses c ON ca.course_id = c.id
         WHERE ar.student_id = $1
         ORDER BY ar.marked_at DESC`,
        [studentRow.id],
      ),

      // My grades
      this.dataSource.query(
        `SELECT c.code AS "courseCode", c.title AS "courseTitle", r.grade, r.score
         FROM academic_results r
         JOIN courses c ON r.course_id = c.id
         WHERE r.student_id = $1 AND r.school_id = $2
         ORDER BY c.code ASC`,
        [studentRow.id, schoolId],
      ),
    ]);

    return { class: cls, classmates, timetable, activeSessions, courses, myAttendance, myGrades };
  }

  // ── Transfer history ───────────────────────────────────────────────────────

  getTransferHistory(studentId: string) {
    return this.transferLogs.listByStudent(studentId);
  }
}
