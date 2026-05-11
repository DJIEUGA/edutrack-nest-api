import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearRepository } from '../infrastructure/academic-year.repository';
import { NotFoundError } from '@common/errors/domain.errors';

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const YEAR_ID   = 'cccccccc-0000-0000-0000-000000000003';

function buildDataSourceMock() {
  const manager: any = { query: jest.fn() };
  const dataSource: any = {
    query: jest.fn(),
    transaction: jest.fn().mockImplementation((cb: any) => cb(manager)),
  };
  return { dataSource, manager };
}

describe('AcademicYearsService', () => {
  let service: AcademicYearsService;
  let mockDs: any;
  let mockMgr: any;
  let mockRepo: any;

  const fakeYear = { id: YEAR_ID, schoolId: SCHOOL_ID, name: '2024-25', startDate: '2024-09-01', endDate: '2025-06-30', isActive: false };

  beforeEach(async () => {
    const { dataSource, manager } = buildDataSourceMock();
    mockDs = dataSource;
    mockMgr = manager;

    mockRepo = {
      list: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      deactivateAll: jest.fn(),
      update: jest.fn(),
    };
    mockRepo.list.mockResolvedValue([fakeYear]);
    mockRepo.create.mockResolvedValue(fakeYear);
    mockRepo.findById.mockResolvedValue(fakeYear);
    mockRepo.deactivateAll.mockResolvedValue(undefined);
    mockRepo.update.mockResolvedValue(fakeYear);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearsService,
        { provide: getDataSourceToken(), useValue: mockDs },
        { provide: AcademicYearRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AcademicYearsService>(AcademicYearsService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('list()', () => {
    it('should delegate to academicYearRepository.list() with schoolId', async () => {
      const result = await service.list(SCHOOL_ID);
      expect(mockRepo.list).toHaveBeenCalledWith(SCHOOL_ID);
      expect(result).toEqual([fakeYear]);
    });
  });

  describe('create()', () => {
    const dto = { name: '2024-25', startDate: '2024-09-01', endDate: '2025-06-30' };

    it('should call deactivateAll before creating when dto.isActive is true', async () => {
      await service.create(SCHOOL_ID, { ...dto, isActive: true });
      expect(mockRepo.deactivateAll).toHaveBeenCalledWith(mockMgr, SCHOOL_ID);
    });

    it('should NOT call deactivateAll when dto.isActive is false', async () => {
      await service.create(SCHOOL_ID, { ...dto, isActive: false });
      expect(mockRepo.deactivateAll).not.toHaveBeenCalled();
    });

    it('should NOT call deactivateAll when dto.isActive is absent', async () => {
      await service.create(SCHOOL_ID, dto);
      expect(mockRepo.deactivateAll).not.toHaveBeenCalled();
    });

    it('should call academicYearRepository.create inside the transaction', async () => {
      await service.create(SCHOOL_ID, dto);
      expect(mockRepo.create).toHaveBeenCalledWith(mockMgr, SCHOOL_ID, expect.objectContaining({ name: dto.name }));
    });

    it('should default isActive to false in the payload when not provided', async () => {
      await service.create(SCHOOL_ID, dto);
      const payload = mockRepo.create.mock.calls[0][2];
      expect(payload.isActive).toBe(false);
    });

    it('should return the created year from the repository', async () => {
      const result = await service.create(SCHOOL_ID, dto);
      expect(result).toEqual(fakeYear);
    });
  });

  describe('getById()', () => {
    it('should return the year when found', async () => {
      const result = await service.getById(SCHOOL_ID, YEAR_ID);
      expect(result).toEqual(fakeYear);
    });

    it('should throw NotFoundError when repository returns null', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.getById(SCHOOL_ID, 'bad-id')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw NotFoundError when repository returns undefined', async () => {
      mockRepo.findById.mockResolvedValue(undefined);
      await expect(service.getById(SCHOOL_ID, 'bad-id')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('update()', () => {
    const patch = { name: 'Updated' };

    it('should return the updated year on success', async () => {
      const updated = { ...fakeYear, name: 'Updated' };
      mockRepo.update.mockResolvedValue(updated);
      const result = await service.update(SCHOOL_ID, YEAR_ID, patch);
      expect(result).toEqual(updated);
    });

    it('should call deactivateAll with excludeId when dto.isActive is true', async () => {
      await service.update(SCHOOL_ID, YEAR_ID, { isActive: true });
      expect(mockRepo.deactivateAll).toHaveBeenCalledWith(mockMgr, SCHOOL_ID, YEAR_ID);
    });

    it('should NOT call deactivateAll when dto.isActive is not true', async () => {
      await service.update(SCHOOL_ID, YEAR_ID, { name: 'X' });
      expect(mockRepo.deactivateAll).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when repository returns null', async () => {
      mockRepo.update.mockResolvedValue(null);
      await expect(service.update(SCHOOL_ID, YEAR_ID, patch)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
