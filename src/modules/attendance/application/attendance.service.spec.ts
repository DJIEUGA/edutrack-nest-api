import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';

const SCHOOL_ID  = 'aaaaaaaa-0000-0000-0000-000000000001';
const SESSION_ID = 'eeeeeeee-0000-0000-0000-000000000005';
const STUDENT_ID = 'ffffffff-0000-0000-0000-000000000006';
const ACTOR_ID   = 'cccccccc-0000-0000-0000-000000000003';

function buildDataSourceMock() {
  const manager: any = { query: jest.fn() };
  const dataSource: any = {
    query: jest.fn(),
    transaction: jest.fn().mockImplementation((cb: any) => cb(manager)),
  };
  return { dataSource, manager };
}

describe('AttendanceService', () => {
  let service: AttendanceService;
  let mockDs: any;
  let mockMgr: any;
  let mockAttendanceRepo: any;

  const fakeRecord = { id: 'rec-1', schoolId: SCHOOL_ID, sessionId: SESSION_ID, studentId: STUDENT_ID, status: 'present' };

  beforeEach(async () => {
    const { dataSource, manager } = buildDataSourceMock();
    mockDs = dataSource;
    mockMgr = manager;

    mockAttendanceRepo = {
      upsert: jest.fn(),
      listBySession: jest.fn(),
      listByStudent: jest.fn(),
    };
    mockAttendanceRepo.upsert.mockResolvedValue(fakeRecord);
    mockAttendanceRepo.listBySession.mockResolvedValue([fakeRecord]);
    mockAttendanceRepo.listByStudent.mockResolvedValue([fakeRecord]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getDataSourceToken(), useValue: mockDs },
        { provide: AttendanceRecordRepository, useValue: mockAttendanceRepo },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('bulkMark()', () => {
    const entries = [
      { studentId: STUDENT_ID, status: 'present' },
      { studentId: 'student-2', status: 'absent' },
    ];

    it('should upsert each entry once and accumulate results', async () => {
      const rec2 = { ...fakeRecord, studentId: 'student-2', status: 'absent' };
      mockAttendanceRepo.upsert.mockResolvedValueOnce(fakeRecord).mockResolvedValueOnce(rec2);

      const result = await service.bulkMark(SCHOOL_ID, SESSION_ID, ACTOR_ID, entries);
      expect(mockAttendanceRepo.upsert).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should pass schoolId, sessionId, and actorId to each upsert call', async () => {
      await service.bulkMark(SCHOOL_ID, SESSION_ID, ACTOR_ID, [entries[0]]);
      expect(mockAttendanceRepo.upsert).toHaveBeenCalledWith(
        mockMgr,
        expect.objectContaining({ schoolId: SCHOOL_ID, sessionId: SESSION_ID, markedBy: ACTOR_ID, studentId: STUDENT_ID }),
      );
    });

    it('should run inside a transaction (not call dataSource.query directly)', async () => {
      await service.bulkMark(SCHOOL_ID, SESSION_ID, ACTOR_ID, entries);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
      expect(mockDs.query).not.toHaveBeenCalled();
    });

    it('should handle an empty entries array and return an empty array', async () => {
      const result = await service.bulkMark(SCHOOL_ID, SESSION_ID, ACTOR_ID, []);
      expect(result).toEqual([]);
      expect(mockAttendanceRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getSessionAttendance()', () => {
    it('should delegate to attendanceRepository.listBySession() with schoolId and sessionId', async () => {
      const result = await service.getSessionAttendance(SCHOOL_ID, SESSION_ID);
      expect(mockAttendanceRepo.listBySession).toHaveBeenCalledWith(SCHOOL_ID, SESSION_ID);
      expect(result).toEqual([fakeRecord]);
    });
  });

  describe('listByStudent()', () => {
    it('should delegate to attendanceRepository.listByStudent() with schoolId and studentId', async () => {
      const result = await service.listByStudent(SCHOOL_ID, STUDENT_ID);
      expect(mockAttendanceRepo.listByStudent).toHaveBeenCalledWith(SCHOOL_ID, STUDENT_ID);
      expect(result).toEqual([fakeRecord]);
    });
  });

  describe('getSummary()', () => {
    it('should call dataSource.query with [schoolId, null, null] when no filters provided', async () => {
      mockDs.query.mockResolvedValue([]);
      await service.getSummary(SCHOOL_ID);
      expect(mockDs.query).toHaveBeenCalledWith(expect.any(String), [SCHOOL_ID, null, null]);
    });

    it('should pass provided academicYearId as second query parameter', async () => {
      mockDs.query.mockResolvedValue([]);
      const YEAR_ID = 'year-uuid';
      await service.getSummary(SCHOOL_ID, { academicYearId: YEAR_ID });
      const params = mockDs.query.mock.calls[0][1];
      expect(params[1]).toBe(YEAR_ID);
    });

    it('should pass provided sessionId as third query parameter', async () => {
      mockDs.query.mockResolvedValue([]);
      await service.getSummary(SCHOOL_ID, { sessionId: SESSION_ID });
      const params = mockDs.query.mock.calls[0][1];
      expect(params[2]).toBe(SESSION_ID);
    });

    it('should return the query result array directly', async () => {
      const rows = [{ studentId: STUDENT_ID, present: 5, absent: 2 }];
      mockDs.query.mockResolvedValue(rows);
      const result = await service.getSummary(SCHOOL_ID);
      expect(result).toEqual(rows);
    });
  });

  describe('getStudentSummary()', () => {
    it('should return the row when query returns data', async () => {
      const row = { studentId: STUDENT_ID, totalSessions: 10, present: 8, late: 1, absent: 1, excused: 0, attendanceRate: 90 };
      mockDs.query.mockResolvedValue([row]);
      const result = await service.getStudentSummary(SCHOOL_ID, STUDENT_ID);
      expect(result).toEqual(row);
    });

    it('should return a default zero-count object when query returns empty', async () => {
      mockDs.query.mockResolvedValue([]);
      const result = await service.getStudentSummary(SCHOOL_ID, STUDENT_ID);
      expect(result).toEqual({
        studentId: STUDENT_ID,
        totalSessions: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        attendanceRate: null,
      });
    });

    it('should pass null for academicYearId when not provided', async () => {
      mockDs.query.mockResolvedValue([{}]);
      await service.getStudentSummary(SCHOOL_ID, STUDENT_ID);
      const params = mockDs.query.mock.calls[0][1];
      expect(params[2]).toBeNull();
    });

    it('should pass provided academicYearId as third query parameter', async () => {
      mockDs.query.mockResolvedValue([{}]);
      const YEAR_ID = 'year-uuid';
      await service.getStudentSummary(SCHOOL_ID, STUDENT_ID, YEAR_ID);
      const params = mockDs.query.mock.calls[0][1];
      expect(params[2]).toBe(YEAR_ID);
    });
  });
});
