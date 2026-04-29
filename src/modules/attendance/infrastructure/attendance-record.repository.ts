import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from '../domain/attendance-record.entity';

@Injectable()
export class AttendanceRecordRepository {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly repo: Repository<AttendanceRecord>,
  ) {}

  findById(id: string): Promise<AttendanceRecord | null> {
    return this.repo.findOne({ where: { id } });
  }

  findBySessionAndStudent(sessionId: string, studentId: string): Promise<AttendanceRecord | null> {
    return this.repo.findOne({ where: { sessionId, studentId } });
  }

  listBySession(schoolId: string, sessionId: string): Promise<AttendanceRecord[]> {
    return this.repo.find({
      where: { schoolId, sessionId },
      order: { markedAt: 'ASC' },
    });
  }

  listByStudent(schoolId: string, studentId: string): Promise<AttendanceRecord[]> {
    return this.repo.find({
      where: { schoolId, studentId },
      order: { markedAt: 'DESC' },
    });
  }

  upsert(input: {
    schoolId: string;
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    markedBy?: string | null;
  }): Promise<AttendanceRecord> {
    const record = this.repo.create({ ...input, markedAt: new Date() });
    return this.repo.save(record);
  }
}
