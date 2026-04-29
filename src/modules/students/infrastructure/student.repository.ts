import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../domain/student.entity';

@Injectable()
export class StudentRepository {
  constructor(
    @InjectRepository(Student)
    private readonly repo: Repository<Student>,
  ) {}

  findById(id: string): Promise<Student | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByUserId(userId: string): Promise<Student | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findByMatricNo(schoolId: string, matricNo: string): Promise<Student | null> {
    return this.repo.findOne({ where: { schoolId, matricNo } });
  }

  list(schoolId: string, classId?: string): Promise<Student[]> {
    const where: Record<string, unknown> = { schoolId };
    if (classId) where.classId = classId;
    return this.repo.find({ where, order: { createdAt: 'ASC' } });
  }

  create(input: {
    schoolId: string;
    userId?: string | null;
    matricNo?: string | null;
    classId?: string | null;
  }): Promise<Student> {
    return this.repo.save(this.repo.create(input));
  }

  async update(
    id: string,
    patch: Partial<Pick<Student, 'matricNo' | 'classId' | 'userId'>>,
  ): Promise<Student | null> {
    await this.repo.update({ id }, patch);
    return this.findById(id);
  }
}
