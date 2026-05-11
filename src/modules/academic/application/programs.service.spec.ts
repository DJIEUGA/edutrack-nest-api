import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { ProgramRepository } from '../infrastructure/program.repository';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';

const SCHOOL_ID  = 'aaaaaaaa-0000-0000-0000-000000000001';
const PROGRAM_ID = 'eeeeeeee-0000-0000-0000-000000000008';

describe('ProgramsService', () => {
  let service: ProgramsService;
  let mockRepo: any;

  const fakeProgram = { id: PROGRAM_ID, schoolId: SCHOOL_ID, code: 'CS101', name: 'Computer Science', durationYears: 4, departmentId: null };

  beforeEach(async () => {
    mockRepo = {
      list: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    mockRepo.list.mockResolvedValue([fakeProgram]);
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(fakeProgram);
    mockRepo.update.mockResolvedValue(fakeProgram);
    mockRepo.delete.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramsService,
        { provide: ProgramRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ProgramsService>(ProgramsService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('list()', () => {
    it('should delegate to programs.list() with schoolId', async () => {
      const result = await service.list(SCHOOL_ID);
      expect(mockRepo.list).toHaveBeenCalledWith(SCHOOL_ID);
      expect(result).toEqual([fakeProgram]);
    });
  });

  describe('create()', () => {
    const input = { schoolId: SCHOOL_ID, code: 'CS101', name: 'Computer Science', durationYears: 4 };

    it('should create a program when the code is unique', async () => {
      const result = await service.create(input);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(result).toEqual(fakeProgram);
    });

    it('should throw ConflictError when code already exists in school', async () => {
      mockRepo.findByCode.mockResolvedValue(fakeProgram);
      await expect(service.create(input)).rejects.toBeInstanceOf(ConflictError);
    });

    it('should default departmentId to null when not provided', async () => {
      await service.create(input);
      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.departmentId).toBeNull();
    });

    it('should forward departmentId when provided', async () => {
      await service.create({ ...input, departmentId: 'dept-1' });
      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.departmentId).toBe('dept-1');
    });
  });

  describe('update()', () => {
    it('should return the updated program on success', async () => {
      const updated = { ...fakeProgram, name: 'Updated CS' };
      mockRepo.update.mockResolvedValue(updated);
      const result = await service.update(SCHOOL_ID, PROGRAM_ID, { name: 'Updated CS' });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when repository returns null', async () => {
      mockRepo.update.mockResolvedValue(null);
      await expect(service.update(SCHOOL_ID, PROGRAM_ID, {})).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('delete()', () => {
    it('should resolve without throwing on success', async () => {
      await expect(service.delete(SCHOOL_ID, PROGRAM_ID)).resolves.toBeUndefined();
    });

    it('should throw NotFoundError when repository returns false', async () => {
      mockRepo.delete.mockResolvedValue(false);
      await expect(service.delete(SCHOOL_ID, PROGRAM_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
