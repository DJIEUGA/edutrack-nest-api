import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { CourseAssignment } from '../domain/course-assignment.entity';
import { CourseAssignmentRepository } from '../infrastructure/course-assignment.repository';

@Injectable()
export class CourseAssignmentsService {
  constructor(private readonly assignments: CourseAssignmentRepository) {}

  async getById(schoolId: string, id: string): Promise<CourseAssignment> {
    const assignment = await this.assignments.findById(id);
    if (!assignment || assignment.schoolId !== schoolId) {
      throw new NotFoundError('Course assignment not found', { id });
    }
    return assignment;
  }

  list(schoolId: string, filters: { lecturerUserId?: string; academicYearId?: string } = {}) {
    return this.assignments.list(schoolId, filters);
  }

  async create(input: {
    schoolId: string;
    courseId: string;
    classId: string;
    lecturerUserId: string;
    academicYearId: string;
  }): Promise<CourseAssignment> {
    const existing = await this.assignments.findExisting(input);
    if (existing) {
      throw new ConflictError('This course is already assigned to that lecturer for this class/year', {
        existingId: existing.id,
      });
    }
    return this.assignments.create(input);
  }

  async lecturerOwnsAssignment(lecturerUserId: string, assignmentId: string): Promise<boolean> {
    const assignment = await this.assignments.findById(assignmentId);
    return !!assignment && assignment.lecturerUserId === lecturerUserId;
  }
}
