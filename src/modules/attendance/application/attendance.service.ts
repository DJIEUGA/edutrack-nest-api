import { Injectable } from '@nestjs/common';
import { AttendanceRecord, AttendanceStatus } from '../domain/attendance-record.entity';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';

@Injectable()
export class AttendanceService {
  constructor(private readonly records: AttendanceRecordRepository) {}

  listBySession(schoolId: string, sessionId: string): Promise<AttendanceRecord[]> {
    return this.records.listBySession(schoolId, sessionId);
  }

  listByStudent(schoolId: string, studentId: string): Promise<AttendanceRecord[]> {
    return this.records.listByStudent(schoolId, studentId);
  }

  markAttendance(input: {
    schoolId: string;
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    markedBy?: string | null;
  }): Promise<AttendanceRecord> {
    return this.records.upsert(input);
  }

  async markBulk(
    schoolId: string,
    sessionId: string,
    markedBy: string,
    entries: Array<{ studentId: string; status: AttendanceStatus }>,
  ): Promise<AttendanceRecord[]> {
    return Promise.all(
      entries.map((e) =>
        this.records.upsert({
          schoolId,
          sessionId,
          studentId: e.studentId,
          status: e.status,
          markedBy,
        }),
      ),
    );
  }
}
