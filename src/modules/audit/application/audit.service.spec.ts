import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { AuditService } from './audit.service';

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function buildDataSourceMock() {
  const manager: any = { query: jest.fn() };
  const dataSource: any = {
    query: jest.fn(),
    transaction: jest.fn().mockImplementation((cb: any) => cb(manager)),
  };
  return { dataSource, manager };
}

describe('AuditService', () => {
  let service: AuditService;
  let mockDs: any;

  const fakeLogs = [
    { id: 'log-1', action: 'user:create', resource: 'user', createdAt: new Date(), actorName: 'Admin', actorEmail: 'admin@e.com' },
  ];

  beforeEach(async () => {
    const { dataSource } = buildDataSourceMock();
    mockDs = dataSource;
    mockDs.query.mockResolvedValue(fakeLogs as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getDataSourceToken(), useValue: mockDs },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('listLogs()', () => {
    it('should call dataSource.query with schoolId as first param', async () => {
      await service.listLogs(SCHOOL_ID);
      const params = (mockDs.query as jest.Mock).mock.calls[0][1] as any[];
      expect(params[0]).toBe(SCHOOL_ID);
    });

    it('should pass default limit=50 and offset=0 when not provided', async () => {
      await service.listLogs(SCHOOL_ID);
      const params = (mockDs.query as jest.Mock).mock.calls[0][1] as any[];
      expect(params[1]).toBe(50);
      expect(params[2]).toBe(0);
    });

    it('should pass custom limit and offset when provided', async () => {
      await service.listLogs(SCHOOL_ID, 20, 40);
      const params = (mockDs.query as jest.Mock).mock.calls[0][1] as any[];
      expect(params[1]).toBe(20);
      expect(params[2]).toBe(40);
    });

    it('should return the query result array', async () => {
      const result = await service.listLogs(SCHOOL_ID);
      expect(result).toEqual(fakeLogs);
    });

    it('SQL should contain ORDER BY a.created_at DESC (contract test)', async () => {
      await service.listLogs(SCHOOL_ID);
      const sql = (mockDs.query as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY a.created_at DESC');
    });

    it('SQL should contain a scope_school_id filter', async () => {
      await service.listLogs(SCHOOL_ID);
      const sql = (mockDs.query as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('scope_school_id');
    });
  });
});
