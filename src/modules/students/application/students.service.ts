import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { Student } from '../domain/student.entity';
import { StudentRepository } from '../infrastructure/student.repository';

@Injectable()
export class StudentsService {
  constructor(private readonly students: StudentRepository) {}

  list(schoolId: string, classId?: string): Promise<Student[]> {
    return this.students.list(schoolId, classId);
  }

  async getById(schoolId: string, id: string): Promise<Student> {
    const student = await this.students.findById(id);
    if (!student || student.schoolId !== schoolId) {
      throw new NotFoundError('Student not found', { id });
    }
    return student;
  }

  async create(input: {
    schoolId: string;
    userId?: string | null;
    matricNo?: string | null;
    classId?: string | null;
  }): Promise<Student> {
    if (input.matricNo) {
      const existing = await this.students.findByMatricNo(input.schoolId, input.matricNo);
      if (existing) {
        throw new ConflictError('Matric number already in use', { matricNo: input.matricNo });
      }
    }
    return this.students.create(input);
  }

  async update(
    schoolId: string,
    id: string,
    patch: { matricNo?: string; classId?: string | null; userId?: string | null },
  ): Promise<Student> {
    await this.getById(schoolId, id);
    const updated = await this.students.update(id, patch);
    if (!updated) throw new NotFoundError('Student not found', { id });
    return updated;
  }
}
