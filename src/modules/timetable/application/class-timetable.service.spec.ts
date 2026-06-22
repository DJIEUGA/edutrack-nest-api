import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ClassTimetableService } from './class-timetable.service';
import { ClassTimetableRepository } from '../infrastructure/class-timetable.repository';
import { ScheduleConfigRepository } from '../../schools/infrastructure/schedule-config.repository';
import { TimetableService } from './timetable.service';
import { ForbiddenError, NotFoundError } from '@common/errors/domain.errors';

const SCHOOL_ID   = 'aaaaaaaa-0000-0000-0000-000000000001';
const CLASS_ID    = 'bbbbbbbb-0000-0000-0000-000000000002';
const ACTOR_ID    = 'cccccccc-0000-0000-0000-000000000003';
const SLOT_ID     = 'dddddddd-0000-0000-0000-000000000004';
const CA_ID       = 'eeeeeeee-0000-0000-0000-000000000005';
const YEAR_ID     = 'ffffffff-0000-0000-0000-000000000006';
const OTHER_CLASS = '22222222-0000-0000-0000-000000000022';

const fakeClass = {
  id: CLASS_ID,
  name: 'L3-Informatique',
  delegateStudentId: null,
  delegateName: null,
  delegateEmail: null,
  delegatePhone: null,
};

const fakeClassWithDelegate = {
  ...fakeClass,
  delegateStudentId: 'student-del',
  delegateName: 'Alice Delegate',
  delegateEmail: 'alice@school.edu',
  delegatePhone: '+237600000000',
};

const fakeTimeBlocks = [
  { id: 'tb-1', startTime: '08:00', endTime: '10:00', label: 'Morning 1' },
  { id: 'tb-2', startTime: '10:00', endTime: '12:00', label: 'Morning 2' },
];

const fakeSlot = {
  id: SLOT_ID,
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  venue: 'Amphi A',
  courseAssignmentId: CA_ID,
  courseCode: 'CS301',
  courseTitle: 'Algorithms',
  lecturerUserId: ACTOR_ID,
  lecturerName: 'Dr. Jean',
  lecturerEmail: 'jean@school.edu',
  lecturerPhone: '+237611111111',
};

const createDto = {
  academicYearId: YEAR_ID,
  courseAssignmentId: CA_ID,
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
};

describe('ClassTimetableService', () => {
  let service: ClassTimetableService;
  let mockClassRepo: any;
  let mockScheduleConfigRepo: any;
  let mockTimetableService: any;

  beforeEach(async () => {
    mockClassRepo = {
      findClassWithDelegate:  jest.fn(),
      findSlotsForClass:      jest.fn(),
      verifyLecturerInClass:  jest.fn(),
      verifyStudentInClass:   jest.fn(),
      verifyHodOverClass:     jest.fn(),
      getCourseAssignment:    jest.fn(),
      slotBelongsToClass:     jest.fn(),
    };
    mockClassRepo.findClassWithDelegate.mockResolvedValue(fakeClass);
    mockClassRepo.findSlotsForClass.mockResolvedValue([fakeSlot]);
    mockClassRepo.verifyLecturerInClass.mockResolvedValue(true);
    mockClassRepo.verifyStudentInClass.mockResolvedValue(true);
    mockClassRepo.verifyHodOverClass.mockResolvedValue(true);
    mockClassRepo.getCourseAssignment.mockResolvedValue({ id: CA_ID, classId: CLASS_ID, lecturerUserId: ACTOR_ID });
    mockClassRepo.slotBelongsToClass.mockResolvedValue(true);

    mockScheduleConfigRepo = {
      getScheduleDays: jest.fn(),
      getTimeBlocks:   jest.fn(),
    };
    mockScheduleConfigRepo.getScheduleDays.mockResolvedValue([1, 2, 3, 4, 5]);
    mockScheduleConfigRepo.getTimeBlocks.mockResolvedValue(fakeTimeBlocks);

    mockTimetableService = {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    mockTimetableService.create.mockResolvedValue({ id: SLOT_ID });
    mockTimetableService.update.mockResolvedValue({ id: SLOT_ID });
    mockTimetableService.remove.mockResolvedValue({ success: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassTimetableService,
        { provide: ClassTimetableRepository,   useValue: mockClassRepo },
        { provide: ScheduleConfigRepository,   useValue: mockScheduleConfigRepo },
        { provide: TimetableService,           useValue: mockTimetableService },
      ],
    }).compile();

    service = module.get<ClassTimetableService>(ClassTimetableService);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  // ─── getSharedTimetable() ─────────────────────────────────────────────────

  describe('getSharedTimetable()', () => {
    it('throws NotFoundError when class does not exist', async () => {
      mockClassRepo.findClassWithDelegate.mockResolvedValueOnce(null);
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('allows owner without checking any class-level access', async () => {
      await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['owner']);
      expect(mockClassRepo.verifyHodOverClass).not.toHaveBeenCalled();
      expect(mockClassRepo.verifyLecturerInClass).not.toHaveBeenCalled();
      expect(mockClassRepo.verifyStudentInClass).not.toHaveBeenCalled();
    });

    it('allows admin without checking any class-level access', async () => {
      await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      expect(mockClassRepo.verifyHodOverClass).not.toHaveBeenCalled();
    });

    it('allows HOD when verifyHodOverClass returns true', async () => {
      mockClassRepo.verifyHodOverClass.mockResolvedValueOnce(true);
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['hod']),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenError when HOD is not over this class', async () => {
      mockClassRepo.verifyHodOverClass.mockResolvedValueOnce(false);
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['hod']),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('allows lecturer when verifyLecturerInClass returns true', async () => {
      mockClassRepo.verifyLecturerInClass.mockResolvedValueOnce(true);
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['lecturer']),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenError when lecturer is not assigned to this class', async () => {
      mockClassRepo.verifyLecturerInClass.mockResolvedValueOnce(false);
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['lecturer']),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('allows student when verifyStudentInClass returns true', async () => {
      mockClassRepo.verifyStudentInClass.mockResolvedValueOnce(true);
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['student']),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenError when student is not enrolled in this class', async () => {
      mockClassRepo.verifyStudentInClass.mockResolvedValueOnce(false);
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['student']),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError for guardian role (no access to shared timetable)', async () => {
      await expect(
        service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['guardian']),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('returns class info, config, and grid in the response shape', async () => {
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      expect(result).toHaveProperty('class');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('grid');
    });

    it('marks a cell as occupied when a slot matches day + startTime + endTime', async () => {
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      const mondayBlocks = result.grid.find((g: any) => g.dayOfWeek === 1)?.blocks;
      const occupied = mondayBlocks?.find((b: any) => b.startTime === '08:00');
      expect(occupied?.status).toBe('occupied');
      expect(occupied?.slot?.id).toBe(SLOT_ID);
    });

    it('marks a cell as free when no slot matches that day + time block', async () => {
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      const mondayBlocks = result.grid.find((g: any) => g.dayOfWeek === 1)?.blocks;
      const free = mondayBlocks?.find((b: any) => b.startTime === '10:00');
      expect(free?.status).toBe('free');
      expect(free?.slot).toBeUndefined();
    });

    it('includes lecturer contact info on occupied cells', async () => {
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      const mondayBlocks = result.grid.find((g: any) => g.dayOfWeek === 1)?.blocks;
      const occupied = mondayBlocks?.find((b: any) => b.startTime === '08:00');
      expect(occupied?.slot?.lecturer).toMatchObject({
        userId: ACTOR_ID,
        name: 'Dr. Jean',
        email: 'jean@school.edu',
        phone: '+237611111111',
      });
    });

    it('returns null delegate when no delegate is assigned to the class', async () => {
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      expect(result.class.delegate).toBeNull();
    });

    it('returns delegate contact info when a delegate is assigned', async () => {
      mockClassRepo.findClassWithDelegate.mockResolvedValueOnce(fakeClassWithDelegate);
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      expect(result.class.delegate).toMatchObject({
        name: 'Alice Delegate',
        email: 'alice@school.edu',
        phone: '+237600000000',
      });
    });

    it('passes academicYearId to findSlotsForClass when provided', async () => {
      await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin'], YEAR_ID);
      expect(mockClassRepo.findSlotsForClass).toHaveBeenCalledWith(SCHOOL_ID, CLASS_ID, YEAR_ID);
    });

    it('builds a grid row for every configured school day', async () => {
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      // Default days are [1,2,3,4,5] from mockScheduleConfigRepo
      expect(result.grid).toHaveLength(5);
      expect(result.grid.map((g: any) => g.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
    });

    it('builds a block entry per time block for each day', async () => {
      const result = await service.getSharedTimetable(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin']);
      result.grid.forEach((day: any) => {
        expect(day.blocks).toHaveLength(fakeTimeBlocks.length);
      });
    });
  });

  // ─── createSlot() ─────────────────────────────────────────────────────────

  describe('createSlot()', () => {
    it('verifies courseAssignment belongs to classId for lecturer role', async () => {
      await service.createSlot(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['lecturer'], createDto);
      expect(mockClassRepo.getCourseAssignment).toHaveBeenCalledWith(CA_ID, SCHOOL_ID);
    });

    it('throws NotFoundError when courseAssignment does not exist (lecturer)', async () => {
      mockClassRepo.getCourseAssignment.mockResolvedValueOnce(null);
      await expect(
        service.createSlot(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['lecturer'], createDto),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ForbiddenError when courseAssignment classId does not match route classId', async () => {
      mockClassRepo.getCourseAssignment.mockResolvedValueOnce({
        id: CA_ID,
        classId: OTHER_CLASS,
        lecturerUserId: ACTOR_ID,
      });
      await expect(
        service.createSlot(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['lecturer'], createDto),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('skips class-scope check for admin and delegates directly to timetableService.create', async () => {
      await service.createSlot(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin'], createDto);
      expect(mockClassRepo.getCourseAssignment).not.toHaveBeenCalled();
      expect(mockTimetableService.create).toHaveBeenCalled();
    });

    it('delegates to timetableService.create with correct arguments on success', async () => {
      await service.createSlot(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['lecturer'], createDto);
      expect(mockTimetableService.create).toHaveBeenCalledWith(
        SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto,
      );
    });

    it('returns the result from timetableService.create', async () => {
      const result = await service.createSlot(SCHOOL_ID, CLASS_ID, ACTOR_ID, ['admin'], createDto);
      expect(result).toEqual({ id: SLOT_ID });
    });
  });

  // ─── updateSlot() ─────────────────────────────────────────────────────────

  describe('updateSlot()', () => {
    const updateDto = { venue: 'Amphi B' };

    it('checks that slot belongs to class for lecturer role', async () => {
      await service.updateSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['lecturer'], updateDto);
      expect(mockClassRepo.slotBelongsToClass).toHaveBeenCalledWith(SLOT_ID, SCHOOL_ID, CLASS_ID);
    });

    it('throws ForbiddenError when slot does not belong to class (lecturer)', async () => {
      mockClassRepo.slotBelongsToClass.mockResolvedValueOnce(false);
      await expect(
        service.updateSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['lecturer'], updateDto),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('skips class-scope check for admin', async () => {
      await service.updateSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['admin'], updateDto);
      expect(mockClassRepo.slotBelongsToClass).not.toHaveBeenCalled();
    });

    it('delegates to timetableService.update with correct arguments', async () => {
      await service.updateSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['lecturer'], updateDto);
      expect(mockTimetableService.update).toHaveBeenCalledWith(
        SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], updateDto,
      );
    });
  });

  // ─── deleteSlot() ─────────────────────────────────────────────────────────

  describe('deleteSlot()', () => {
    it('checks that slot belongs to class for lecturer role', async () => {
      await service.deleteSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['lecturer']);
      expect(mockClassRepo.slotBelongsToClass).toHaveBeenCalledWith(SLOT_ID, SCHOOL_ID, CLASS_ID);
    });

    it('throws ForbiddenError when slot does not belong to class (lecturer)', async () => {
      mockClassRepo.slotBelongsToClass.mockResolvedValueOnce(false);
      await expect(
        service.deleteSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['lecturer']),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('skips class-scope check for hod role', async () => {
      await service.deleteSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['hod']);
      expect(mockClassRepo.slotBelongsToClass).not.toHaveBeenCalled();
    });

    it('delegates to timetableService.remove with correct arguments', async () => {
      await service.deleteSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['admin']);
      expect(mockTimetableService.remove).toHaveBeenCalledWith(
        SCHOOL_ID, SLOT_ID, ACTOR_ID, ['admin'],
      );
    });

    it('returns { success: true } from timetableService.remove', async () => {
      const result = await service.deleteSlot(SCHOOL_ID, CLASS_ID, SLOT_ID, ACTOR_ID, ['admin']);
      expect(result).toEqual({ success: true });
    });
  });
});
