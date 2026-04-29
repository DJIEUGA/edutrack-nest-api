import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../domain/course.entity';

@Injectable()
export class CourseRepository {
  constructor(
    @InjectRepository(Course)
    private readonly repo: Repository<Course>,
  ) {}

  list(schoolId: string): Promise<Course[]> {
    return this.repo.find({ where: { schoolId }, order: { code: 'ASC' } });
  }

  findById(id: string): Promise<Course | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(schoolId: string, code: string): Promise<Course | null> {
    return this.repo.findOne({ where: { schoolId, code } });
  }

  create(input: {
    schoolId: string;
    code: string;
    title: string;
    unitLoad: number;
    departmentId?: string | null;
  }): Promise<Course> {
    return this.repo.save(this.repo.create(input));
  }
}
