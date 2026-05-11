import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { StudentsService } from '@modules/students/application/students.service';
import { NotFoundError, ValidationError } from '@common/errors/domain.errors';

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID   = 'bbbbbbbb-0000-0000-0000-000000000002';
const JOB_ID    = 'jjjjjjjj-0000-0000-0000-000000000010';

function buildDataSourceMock() {
  const manager: any = { query: jest.fn() };
  const dataSource: any = {
    query: jest.fn(),
    transaction: jest.fn().mockImplementation((cb: any) => cb(manager)),
  };
  return { dataSource, manager };
}

describe('ImportsService', () => {
  let service: ImportsService;
  let mockDs: any;
  let mockMgr: any;
  let mockStudentsService: any;

  const pendingJob = {
    id: JOB_ID, schoolId: SCHOOL_ID, type: 'students',
    status: 'pending', sourceFileUrl: 'https://example.com/file.csv',
  };

  const awaitingJob = { ...pendingJob, status: 'awaiting_confirmation' };

  beforeEach(async () => {
    const { dataSource, manager } = buildDataSourceMock();
    mockDs = dataSource;
    mockMgr = manager;

    mockStudentsService = { bulkImport: jest.fn() };
    mockStudentsService.bulkImport.mockResolvedValue({ created: 0, failed: 0, errors: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsService,
        { provide: getDataSourceToken(), useValue: mockDs },
        { provide: StudentsService, useValue: mockStudentsService },
      ],
    }).compile();

    service = module.get<ImportsService>(ImportsService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('listJobs()', () => {
    it('should call dataSource.query with schoolId', async () => {
      mockDs.query.mockResolvedValue([]);
      await service.listJobs(SCHOOL_ID);
      expect(mockDs.query).toHaveBeenCalledWith(expect.any(String), [SCHOOL_ID]);
    });

    it('should return the query result', async () => {
      const jobs = [awaitingJob];
      mockDs.query.mockResolvedValue(jobs);
      const result = await service.listJobs(SCHOOL_ID);
      expect(result).toEqual(jobs);
    });
  });

  describe('createJob()', () => {
    it('should INSERT a pending job, validate it, then return the final job', async () => {
      mockDs.query
        .mockResolvedValueOnce([pendingJob])  // INSERT RETURNING
        .mockResolvedValueOnce(undefined)      // UPDATE (validateJob private)
        .mockResolvedValueOnce([awaitingJob]); // SELECT (getJob)

      const result = await service.createJob(SCHOOL_ID, USER_ID, { type: 'students', sourceFileUrl: 'https://example.com/file.csv' });
      expect(mockDs.query).toHaveBeenCalledTimes(3);
      expect(result).toEqual(awaitingJob);
    });

    it('should INSERT into import_jobs with status pending', async () => {
      mockDs.query
        .mockResolvedValueOnce([pendingJob])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([awaitingJob]);

      await service.createJob(SCHOOL_ID, USER_ID, { type: 'students', sourceFileUrl: 'url' });
      const firstSql = mockDs.query.mock.calls[0][0] as string;
      expect(firstSql).toContain('import_jobs');
      expect(firstSql).toContain('pending');
    });
  });

  describe('getJob()', () => {
    it('should return the job when found', async () => {
      mockDs.query.mockResolvedValue([awaitingJob]);
      const result = await service.getJob(JOB_ID, SCHOOL_ID);
      expect(result).toEqual(awaitingJob);
    });

    it('should throw NotFoundError when no job matches id and schoolId', async () => {
      mockDs.query.mockResolvedValue([]);
      await expect(service.getJob('unknown-id', SCHOOL_ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should query by both id and school_id', async () => {
      mockDs.query.mockResolvedValue([awaitingJob]);
      await service.getJob(JOB_ID, SCHOOL_ID);
      expect(mockDs.query).toHaveBeenCalledWith(expect.any(String), [JOB_ID, SCHOOL_ID]);
    });
  });

  describe('commitJob()', () => {
    it('should throw ValidationError when job status is not awaiting_confirmation', async () => {
      mockDs.query.mockResolvedValue([pendingJob]);
      await expect(service.commitJob(JOB_ID, SCHOOL_ID)).rejects.toBeInstanceOf(ValidationError);
    });

    it('should call studentsService.bulkImport for type "students"', async () => {
      mockDs.query.mockResolvedValue([awaitingJob]);
      await service.commitJob(JOB_ID, SCHOOL_ID);
      expect(mockStudentsService.bulkImport).toHaveBeenCalled();
    });

    it('should update job status to committed in a transaction', async () => {
      mockDs.query.mockResolvedValue([awaitingJob]);
      await service.commitJob(JOB_ID, SCHOOL_ID);
      const updateCall = mockMgr.query.mock.calls.find((c: any) => (c[0] as string).includes('committed'));
      expect(updateCall).toBeDefined();
    });

    it('should return { success: true, status: "committed" }', async () => {
      mockDs.query.mockResolvedValue([awaitingJob]);
      const result = await service.commitJob(JOB_ID, SCHOOL_ID);
      expect(result).toEqual({ success: true, status: 'committed' });
    });
  });

  describe('cancelJob()', () => {
    it('should return { success: true } when deletion succeeds', async () => {
      mockDs.query.mockResolvedValue([undefined, 1]);
      const result = await service.cancelJob(JOB_ID, SCHOOL_ID);
      expect(result).toEqual({ success: true });
    });

    it('should throw ValidationError when DELETE affects 0 rows (committed job)', async () => {
      mockDs.query.mockResolvedValue([undefined, 0]);
      await expect(service.cancelJob(JOB_ID, SCHOOL_ID)).rejects.toBeInstanceOf(ValidationError);
    });

    it('should DELETE with the job id and school id', async () => {
      mockDs.query.mockResolvedValue([undefined, 1]);
      await service.cancelJob(JOB_ID, SCHOOL_ID);
      expect(mockDs.query).toHaveBeenCalledWith(expect.any(String), [JOB_ID, SCHOOL_ID]);
    });
  });
});
