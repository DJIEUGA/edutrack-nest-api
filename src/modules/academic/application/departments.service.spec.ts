import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { DepartmentRepository } from '../infrastructure/department.repository';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const DEPT_ID   = 'dddddddd-0000-0000-0000-000000000007';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let mockRepo: any;

  const fakeDept = { id: DEPT_ID, schoolId: SCHOOL_ID, code: 'CS', name: 'Computer Science' };

  beforeEach(async () => {
    mockRepo = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    mockRepo.list.mockResolvedValue([fakeDept]);
    mockRepo.create.mockResolvedValue(fakeDept);
    mockRepo.update.mockResolvedValue(fakeDept);
    mockRepo.delete.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: DepartmentRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('list()', () => {
    it('should delegate to departmentRepository.list() with schoolId', async () => {
      const result = await service.list(SCHOOL_ID);
      expect(mockRepo.list).toHaveBeenCalledWith(SCHOOL_ID);
      expect(result).toEqual([fakeDept]);
    });
  });

  describe('create()', () => {
    const dto = { code: 'CS', name: 'Computer Science' };

    it('should return the created department on success', async () => {
      const result = await service.create(SCHOOL_ID, dto);
      expect(result).toEqual(fakeDept);
    });

    it('should throw ConflictError when the repository throws with pg code 23505', async () => {
      const pgErr = Object.assign(new Error('dup'), { code: '23505' });
      mockRepo.create.mockRejectedValue(pgErr);
      await expect(service.create(SCHOOL_ID, dto)).rejects.toBeInstanceOf(ConflictError);
    });

    it('should rethrow non-conflict errors unchanged', async () => {
      const otherErr = new Error('some other error');
      mockRepo.create.mockRejectedValue(otherErr);
      await expect(service.create(SCHOOL_ID, dto)).rejects.toBe(otherErr);
    });
  });

  describe('update()', () => {
    it('should return the updated department on success', async () => {
      const updated = { ...fakeDept, name: 'Updated CS' };
      mockRepo.update.mockResolvedValue(updated);
      const result = await service.update(SCHOOL_ID, DEPT_ID, { name: 'Updated CS' });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when repository returns null', async () => {
      mockRepo.update.mockResolvedValue(null);
      await expect(service.update(SCHOOL_ID, DEPT_ID, {})).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('delete()', () => {
    it('should resolve without throwing on success', async () => {
      await expect(service.delete(SCHOOL_ID, DEPT_ID)).resolves.toBeUndefined();
    });

    it('should throw NotFoundError when repository returns false', async () => {
      mockRepo.delete.mockResolvedValue(false);
      await expect(service.delete(SCHOOL_ID, DEPT_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
