import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundError, ConflictError } from '@common/errors/domain.errors';
import { StudentsRepository } from '../infrastructure/students.repository';

@Injectable()
export class StudentsService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private readonly studentsRepository: StudentsRepository,
  ) {}

  /**
   * Lists students with their user details and current status.
   * Satisfies Section 12.2 and 21.8 of the contract.
   */
  async listBySchool(schoolId: string, status?: string) {
    return this.studentsRepository.listBySchool(schoolId, status);
  }

  /**
   * Searches and filters students based on program, level, and status.
   */
  async search(schoolId: string, filters: { programId?: string; level?: number; status?: string; limit?: number; offset?: number }) {
    return this.studentsRepository.search(schoolId, filters);
  }

  /**
   * Fetches a single student by ID within a school context.
   */
  async getById(schoolId: string, studentId: string) {
    const row = await this.studentsRepository.findById(studentId, schoolId);
    if (!row) throw new NotFoundError('Student not found');
    return row;
  }

  /**
   * Creates a new student record and links it to a user.
   */
  async create(schoolId: string, dto: { userId: string; matricNo?: string; classId?: string }) {
    const existingUser = await this.studentsRepository.findByUserId(schoolId, dto.userId);
    if (existingUser) {
      throw new ConflictError('User already has a student record in this school');
    }

    if (dto.matricNo) {
      const existing = await this.studentsRepository.findByMatricNo(schoolId, dto.matricNo);
      if (existing) {
        throw new ConflictError('Matriculation number already exists in this school', { matricNo: dto.matricNo });
      }
    }

    const studentId = await this.studentsRepository.create(schoolId, dto);
    return this.getById(schoolId, studentId);
  }

  /**
   * Bulk imports student records.
   * Utilizes internal create logic to enforce repository validations (matricNo and userId uniqueness).
   */
  async bulkImport(schoolId: string, students: Array<{ userId: string; matricNo?: string; classId?: string }>) {
    const results = {
      total: students.length,
      created: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const studentDto of students) {
      try {
        await this.create(schoolId, studentDto);
        results.created++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ student: studentDto, error: err.message });
      }
    }

    return results;
  }

  /**
   * Removes a student record from a specific school.
   */
  async remove(schoolId: string, studentId: string) {
    const success = await this.studentsRepository.delete(studentId, schoolId);
    if (!success) throw new NotFoundError('Student record not found');
    return { success: true };
  }

  /**
   * Updates student status. Requires audit trail required for transcript verification.
   */
  async updateStatus(
    actorId: string,
    schoolId: string,
    studentId: string,
    status: string,
    rejectionReason: string
  ) {
    return await this.dataSource.transaction(async (manager) => {
      const student = await this.studentsRepository.findByIdInTransaction(manager, studentId, schoolId);
      if (!student) throw new NotFoundError('Student record not found');

      await this.studentsRepository.updateStatus(manager, studentId, status, rejectionReason);

      // Log the action for the audit trail (Section 18)
      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          actorId,
          schoolId,
          `enrollment:${status}`,
          'student',
          studentId,
          JSON.stringify({ rejectionReason }),
        ],
      );

      return this.studentsRepository.findRawById(manager, studentId);
    });
  }
}