import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { Course } from '../domain/course.entity';
import { CourseRepository } from '../infrastructure/course.repository';

@Injectable()
export class CoursesService {
  constructor(private readonly courses: CourseRepository) {}

  list(schoolId: string): Promise<Course[]> {
    return this.courses.list(schoolId);
  }

  async getById(schoolId: string, id: string): Promise<Course> {
    const course = await this.courses.findById(id);
    if (!course || course.schoolId !== schoolId) {
      throw new NotFoundError('Course not found', { id });
    }
    return course;
  }

  async create(input: {
    schoolId: string;
    code: string;
    title: string;
    unitLoad?: number;
    departmentId?: string;
  }): Promise<Course> {
    const existing = await this.courses.findByCode(input.schoolId, input.code);
    if (existing) throw new ConflictError('Course code already in use', { code: input.code });
    return this.courses.create({
      schoolId: input.schoolId,
      code: input.code,
      title: input.title,
      unitLoad: input.unitLoad ?? 2,
      departmentId: input.departmentId ?? null,
    });
  }
}
