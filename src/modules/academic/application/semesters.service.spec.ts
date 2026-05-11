import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SemestersService } from './semesters.service';
import { SemesterRepository } from '../infrastructure/semester.repository';
import { AcademicYearsService } from './academic-years.service';
import { NotFoundError, ValidationError } from '@common/errors/domain.errors';

const SCHOOL_ID   = 'aaaaaaaa-0000-0000-0000-000000000001';
const YEAR_ID     = 'cccccccc-0000-0000-0000-000000000003';
const SEMESTER_ID = 'ffffffff-0000-0000-0000-000000000009';

describe('SemestersService', () => {
  let service: SemestersService;
  let mockRepo: any;
  let mockYearsService: any;

  const fakeYear = {
    id: YEAR_ID, schoolId: SCHOOL_ID,
    name: '2024-25', startDate: '2024-09-01', endDate: '2025-06-30', isActive: true,
  };

  const fakeSemester = {
    id: SEMESTER_ID, academicYearId: YEAR_ID,
    name: 'Semester 1', startDate: '2024-09-01', endDate: '2025-01-31', isCurrent: false,
  };

  beforeEach(async () => {
    mockRepo = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    mockRepo.list.mockResolvedValue([fakeSemester]);
    mockRepo.create.mockResolvedValue(fakeSemester);
    mockRepo.update.mockResolvedValue(fakeSemester);

    mockYearsService = {
      getById: jest.fn(),
    };
    mockYearsService.getById.mockResolvedValue(fakeYear);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemestersService,
        { provide: SemesterRepository, useValue: mockRepo },
        { provide: AcademicYearsService, useValue: mockYearsService },
      ],
    }).compile();

    service = module.get<SemestersService>(SemestersService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('list()', () => {
    it('should delegate to semesters.list() with academicYearId', async () => {
      const result = await service.list(YEAR_ID);
      expect(mockRepo.list).toHaveBeenCalledWith(YEAR_ID);
      expect(result).toEqual([fakeSemester]);
    });
  });

  describe('create()', () => {
    const validInput = {
      schoolId: SCHOOL_ID,
      academicYearId: YEAR_ID,
      name: 'Semester 1',
      startDate: '2024-09-01',
      endDate: '2025-01-31',
    };

    it('should call academicYears.getById() to validate the year exists', async () => {
      await service.create(validInput);
      expect(mockYearsService.getById).toHaveBeenCalledWith(SCHOOL_ID, YEAR_ID);
    });

    it('should create the semester and return it when dates are valid', async () => {
      const result = await service.create(validInput);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(result).toEqual(fakeSemester);
    });

    it('should default isCurrent to false when not provided', async () => {
      await service.create(validInput);
      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.isCurrent).toBe(false);
    });

    it('should throw ValidationError when startDate is before the year startDate', async () => {
      await expect(service.create({ ...validInput, startDate: '2024-01-01' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError when endDate is after the year endDate', async () => {
      await expect(service.create({ ...validInput, endDate: '2025-12-31' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError when startDate equals endDate', async () => {
      await expect(
        service.create({ ...validInput, startDate: '2024-09-01', endDate: '2024-09-01' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError when startDate is after endDate', async () => {
      await expect(
        service.create({ ...validInput, startDate: '2025-01-31', endDate: '2024-09-01' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('update()', () => {
    it('should return the updated semester on success', async () => {
      const updated = { ...fakeSemester, name: 'Updated' };
      mockRepo.update.mockResolvedValue(updated);
      const result = await service.update(SEMESTER_ID, { name: 'Updated' });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when repository returns null', async () => {
      mockRepo.update.mockResolvedValue(null);
      await expect(service.update(SEMESTER_ID, {})).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
