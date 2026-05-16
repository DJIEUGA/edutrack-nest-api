import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEnrollmentRequest, EnrollmentRequestStatus } from '../domain/class-enrollment-request.entity';

@Injectable()
export class ClassEnrollmentRequestRepository {
  constructor(
    @InjectRepository(ClassEnrollmentRequest)
    private readonly repo: Repository<ClassEnrollmentRequest>,
  ) {}

  findById(id: string): Promise<ClassEnrollmentRequest | null> {
    return this.repo.findOne({ where: { id } });
  }

  findPendingByStudentAndClass(
    studentId: string,
    classId: string,
  ): Promise<ClassEnrollmentRequest | null> {
    return this.repo.findOne({ where: { studentId, classId, status: 'pending' } });
  }

  listByClass(
    schoolId: string,
    classId: string,
    status?: EnrollmentRequestStatus,
  ): Promise<ClassEnrollmentRequest[]> {
    return this.repo.find({
      where: status ? { schoolId, classId, status } : { schoolId, classId },
      order: { createdAt: 'ASC' },
    });
  }

  create(input: {
    schoolId: string;
    studentId: string;
    classId: string;
    requestedBy: string;
    notes?: string;
  }): Promise<ClassEnrollmentRequest> {
    return this.repo.save(
      this.repo.create({
        schoolId: input.schoolId,
        studentId: input.studentId,
        classId: input.classId,
        requestedBy: input.requestedBy,
        notes: input.notes ?? null,
        status: 'pending',
      }),
    );
  }

  async approve(
    id: string,
    reviewedBy: string,
  ): Promise<ClassEnrollmentRequest | null> {
    await this.repo.update(
      { id },
      { status: 'approved', reviewedBy, reviewedAt: new Date() },
    );
    return this.repo.findOne({ where: { id } });
  }

  async reject(
    id: string,
    reviewedBy: string,
    notes?: string,
  ): Promise<ClassEnrollmentRequest | null> {
    await this.repo.update(
      { id },
      { status: 'rejected', reviewedBy, reviewedAt: new Date(), notes: notes ?? null },
    );
    return this.repo.findOne({ where: { id } });
  }
}
