import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassTransferLog } from '../domain/class-transfer-log.entity';

@Injectable()
export class ClassTransferLogRepository {
  constructor(
    @InjectRepository(ClassTransferLog)
    private readonly repo: Repository<ClassTransferLog>,
  ) {}

  create(input: {
    schoolId: string;
    studentId: string;
    fromClassId?: string | null;
    toClassId?: string | null;
    reason?: string;
    transferredBy: string;
  }): Promise<ClassTransferLog> {
    return this.repo.save(
      this.repo.create({
        schoolId: input.schoolId,
        studentId: input.studentId,
        fromClassId: input.fromClassId ?? null,
        toClassId: input.toClassId ?? null,
        reason: input.reason ?? null,
        transferredBy: input.transferredBy,
        transferredAt: new Date(),
      }),
    );
  }

  listByStudent(studentId: string): Promise<ClassTransferLog[]> {
    return this.repo.find({
      where: { studentId },
      order: { transferredAt: 'DESC' },
    });
  }
}
