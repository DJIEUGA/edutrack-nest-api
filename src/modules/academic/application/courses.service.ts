import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundError } from '@common/errors/domain.errors';
import { CoursesRepository } from '../infrastructure/courses.repository';

@Injectable()
export class CoursesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async list(schoolId: string) {
    return this.coursesRepository.findAll(schoolId);
  }

  async create(schoolId: string, dto: { 
    code: string; 
    title: string; 
    unitLoad: number; 
    departmentId?: string 
  }) {
    return this.coursesRepository.create(schoolId, dto);
  }

  /**
   * Course Assignments: The "Authorized Actor" record.
   * This proves who was permitted to teach/grade a specific class.
   */
  async assign(schoolId: string, dto: {
    courseId: string;
    classId: string;
    lecturerUserId: string;
    academicYearId: string;
  }) {
    return await this.dataSource.transaction(async (manager) => {
      const assignment = await this.coursesRepository.createAssignment(manager, schoolId, dto);

      // Audit the assignment for transcript integrity
      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          dto.lecturerUserId, // The person being assigned
          schoolId,
          'course:assigned',
          'course_assignment',
          assignment.id,
          JSON.stringify({ courseId: dto.courseId, classId: dto.classId })
        ]
      );

      return assignment;
    });
  }

  async update(schoolId: string, courseId: string, dto: {
    code?: string;
    title?: string;
    unitLoad?: number;
    departmentId?: string | null;
  }) {
    const course = await this.coursesRepository.update(courseId, schoolId, dto);
    if (!course) throw new NotFoundError('Course not found');
    return course;
  }

  async delete(schoolId: string, courseId: string): Promise<void> {
    const deleted = await this.coursesRepository.delete(courseId, schoolId);
    if (!deleted) throw new NotFoundError('Course not found');
  }

  async listAssignments(schoolId: string, academicYearId?: string) {
    return this.coursesRepository.findAllAssignments(schoolId, academicYearId);
  }
}