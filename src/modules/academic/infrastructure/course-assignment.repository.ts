import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseAssignment } from '../domain/course-assignment.entity';

@Injectable()
export class CourseAssignmentRepository {
  constructor(
    @InjectRepository(CourseAssignment)
    private readonly repo: Repository<CourseAssignment>,
  ) {}

  findById(id: string): Promise<CourseAssignment | null> {
    return this.repo.findOne({ where: { id } });
  }

  list(schoolId: string, filters: { lecturerUserId?: string; academicYearId?: string } = {}) {
    const where: Record<string, unknown> = { schoolId };
    if (filters.lecturerUserId) where.lecturerUserId = filters.lecturerUserId;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    return this.repo.find({ where, order: { createdAt: 'ASC' } });
  }

  findExisting(input: {
    schoolId: string;
    courseId: string;
    classId: string;
    lecturerUserId: string;
    academicYearId: string;
  }): Promise<CourseAssignment | null> {
    return this.repo.findOne({ where: input });
  }

  create(input: {
    schoolId: string;
    courseId: string;
    classId: string;
    lecturerUserId: string;
    academicYearId: string;
  }): Promise<CourseAssignment> {
    return this.repo.save(this.repo.create(input));
  }
}
