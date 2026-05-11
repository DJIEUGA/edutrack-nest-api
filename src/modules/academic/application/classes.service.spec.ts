import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassRepository } from '../infrastructure/class.repository';
import { AcademicYearsService } from './academic-years.service';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const YEAR_ID   = 'cccccccc-0000-0000-0000-000000000003';
const CLASS_ID  = 'dddddddd-0000-0000-0000-000000000004';

describe('ClassesService', () => {
  let service: ClassesService;
  let mockClassRepo: any;
  let mockYearsService: any;

  const fakeYear = { id: YEAR_ID, schoolId: SCHOOL_ID, name: '2024-25', startDate: '2024-09-01', endDate: '2025-06-30', isActive: true };
  const fakeClass = { id: CLASS_ID, schoolId: SCHOOL_ID, academicYearId: YEAR_ID, name: 'Class A', programId: null, specialtyId: null, level: null };

  beforeEach(async () => {
    mockClassRepo = {
      list: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    mockClassRepo.list.mockResolvedValue([fakeClass]);
    mockClassRepo.findById.mockResolvedValue(fakeClass);
    mockClassRepo.findByName.mockResolvedValue(null);
    mockClassRepo.create.mockResolvedValue(fakeClass);
    mockClassRepo.update.mockResolvedValue(fakeClass);
    mockClassRepo.delete.mockResolvedValue(true);

    mockYearsService = { getById: jest.fn() };
    mockYearsService.getById.mockResolvedValue(fakeYear);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: ClassRepository, useValue: mockClassRepo },
        { provide: AcademicYearsService, useValue: mockYearsService },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('list()', () => {
    it('should delegate to classes.list() with schoolId', async () => {
      await service.list(SCHOOL_ID);
      expect(mockClassRepo.list).toHaveBeenCalledWith(SCHOOL_ID, undefined);
    });

    it('should pass optional academicYearId when provided', async () => {
      await service.list(SCHOOL_ID, YEAR_ID);
      expect(mockClassRepo.list).toHaveBeenCalledWith(SCHOOL_ID, YEAR_ID);
    });
  });

  describe('getById()', () => {
    it('should return the class when found and schoolId matches', async () => {
      const result = await service.getById(SCHOOL_ID, CLASS_ID);
      expect(result).toEqual(fakeClass);
    });

    it('should throw NotFoundError when no class is found', async () => {
      mockClassRepo.findById.mockResolvedValue(null);
      await expect(service.getById(SCHOOL_ID, 'bad-id')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw NotFoundError when class belongs to a different school', async () => {
      mockClassRepo.findById.mockResolvedValue({ ...fakeClass, schoolId: 'other-school' });
      await expect(service.getById(SCHOOL_ID, CLASS_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('create()', () => {
    const input = { schoolId: SCHOOL_ID, academicYearId: YEAR_ID, name: 'Class B' };

    it('should call years.getById() to validate the academic year', async () => {
      await service.create(input);
      expect(mockYearsService.getById).toHaveBeenCalledWith(SCHOOL_ID, YEAR_ID);
    });

    it('should call classes.findByName() to check for duplicates', async () => {
      await service.create(input);
      expect(mockClassRepo.findByName).toHaveBeenCalledWith(SCHOOL_ID, YEAR_ID, 'Class B');
    });

    it('should throw ConflictError when a class with the same name already exists', async () => {
      mockClassRepo.findByName.mockResolvedValue(fakeClass);
      await expect(service.create(input)).rejects.toBeInstanceOf(ConflictError);
    });

    it('should call classes.create() with null-defaulted optional fields', async () => {
      await service.create(input);
      const createArg = mockClassRepo.create.mock.calls[0][0];
      expect(createArg.programId).toBeNull();
      expect(createArg.specialtyId).toBeNull();
      expect(createArg.level).toBeNull();
    });

    it('should return the created ClassEntity', async () => {
      const result = await service.create(input);
      expect(result).toEqual(fakeClass);
    });

    it('should forward optional programId, specialtyId, level when provided', async () => {
      await service.create({ ...input, programId: 'prog-1', specialtyId: 'spec-1', level: 2 });
      const createArg = mockClassRepo.create.mock.calls[0][0];
      expect(createArg.programId).toBe('prog-1');
      expect(createArg.specialtyId).toBe('spec-1');
      expect(createArg.level).toBe(2);
    });
  });

  describe('update()', () => {
    it('should call classes.update() with classId, schoolId, and patch', async () => {
      await service.update(SCHOOL_ID, CLASS_ID, { name: 'Updated' });
      expect(mockClassRepo.update).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID, { name: 'Updated' });
    });

    it('should throw NotFoundError when classes.update() returns null', async () => {
      mockClassRepo.update.mockResolvedValue(null);
      await expect(service.update(SCHOOL_ID, CLASS_ID, {})).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should return the updated ClassEntity', async () => {
      const updated = { ...fakeClass, name: 'Updated' };
      mockClassRepo.update.mockResolvedValue(updated);
      const result = await service.update(SCHOOL_ID, CLASS_ID, { name: 'Updated' });
      expect(result).toEqual(updated);
    });
  });

  describe('delete()', () => {
    it('should call classes.delete() with classId and schoolId', async () => {
      await service.delete(SCHOOL_ID, CLASS_ID);
      expect(mockClassRepo.delete).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID);
    });

    it('should throw NotFoundError when classes.delete() returns falsy', async () => {
      mockClassRepo.delete.mockResolvedValue(false);
      await expect(service.delete(SCHOOL_ID, CLASS_ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should resolve without throwing on success', async () => {
      await expect(service.delete(SCHOOL_ID, CLASS_ID)).resolves.toBeUndefined();
    });
  });
});
