import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TimetableService } from './timetable.service';
import { TimetableRepository } from '../infrastructure/timetable.repository';
import { VenuesRepository } from '../../schools/infrastructure/venues.repository';
import { ScheduleConfigRepository } from '../../schools/infrastructure/schedule-config.repository';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@common/errors/domain.errors';

const SCHOOL_ID   = 'aaaaaaaa-0000-0000-0000-000000000001';
const ACTOR_ID    = 'bbbbbbbb-0000-0000-0000-000000000002';
const OTHER_ID    = 'cccccccc-0000-0000-0000-000000000003';
const SLOT_ID     = 'dddddddd-0000-0000-0000-000000000004';
const CA_ID       = 'eeeeeeee-0000-0000-0000-000000000005';
const YEAR_ID     = 'ffffffff-0000-0000-0000-000000000006';
const VENUE_ID    = '11111111-0000-0000-0000-000000000011';

const fakeSlot = {
  id: SLOT_ID,
  schoolId: SCHOOL_ID,
  courseAssignmentId: CA_ID,
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  venue: null,
};

// Raw row returned by timetableRepository.findById (camelCase aliases from SQL)
const fakeExistingSlot = {
  id: SLOT_ID,
  schoolId: SCHOOL_ID,
  courseAssignmentId: CA_ID,
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  venue: null,
};

function buildDataSourceMock() {
  const manager: any = { query: jest.fn() };
  const dataSource: any = {
    query: jest.fn(),
    transaction: jest.fn().mockImplementation((cb: any) => cb(manager)),
  };
  return { dataSource, manager };
}

describe('TimetableService', () => {
  let service: TimetableService;
  let mockDs: any;
  let mockMgr: any;
  let mockTimetableRepo: any;
  let mockVenuesRepo: any;
  let mockRoleResolver: any;
  let mockScheduleConfigRepo: any;

  const createDto = {
    academicYearId: YEAR_ID,
    courseAssignmentId: CA_ID,
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
  };

  beforeEach(async () => {
    const { dataSource, manager } = buildDataSourceMock();
    mockDs  = dataSource;
    mockMgr = manager;

    mockTimetableRepo = {
      list:          jest.fn(),
      findById:      jest.fn(),
      checkConflict: jest.fn(),
      create:        jest.fn(),
      update:        jest.fn(),
    };
    mockTimetableRepo.list.mockResolvedValue([]);
    mockTimetableRepo.findById.mockResolvedValue(fakeExistingSlot);
    mockTimetableRepo.checkConflict.mockResolvedValue(false);
    mockTimetableRepo.create.mockResolvedValue(fakeSlot);
    mockTimetableRepo.update.mockResolvedValue(fakeSlot);

    mockVenuesRepo = { findById: jest.fn() };
    mockVenuesRepo.findById.mockResolvedValue({ id: VENUE_ID, name: 'Amphi 200' });

    mockRoleResolver = { listRolesForUser: jest.fn() };
    mockRoleResolver.listRolesForUser.mockResolvedValue(['lecturer']);

    mockScheduleConfigRepo = { timeBlockExists: jest.fn() };
    mockScheduleConfigRepo.timeBlockExists.mockResolvedValue(true);

    // Default: all manager.query calls return [] — academic year not found → skip session generation,
    // nextSessionId query returns [] → nextSessionId = null. Override per-test when needed.
    mockMgr.query.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: getDataSourceToken(),       useValue: mockDs },
        { provide: TimetableRepository,        useValue: mockTimetableRepo },
        { provide: VenuesRepository,           useValue: mockVenuesRepo },
        { provide: RoleResolverService,        useValue: mockRoleResolver },
        { provide: ScheduleConfigRepository,   useValue: mockScheduleConfigRepo },
      ],
    }).compile();

    service = module.get<TimetableService>(TimetableService);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  // ─── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('checks lecturer ownership before opening transaction', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      await service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto);
      expect(mockDs.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM course_assignments'),
        [CA_ID, SCHOOL_ID],
      );
    });

    it('throws ForbiddenError when lecturer does not own the course assignment', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: OTHER_ID }]);
      await expect(
        service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws NotFoundError when course assignment does not exist', async () => {
      mockDs.query.mockResolvedValueOnce([]);
      await expect(
        service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('skips ownership check entirely for admin role', async () => {
      await service.create(SCHOOL_ID, ACTOR_ID, ['admin'], createDto);
      expect(mockDs.query).not.toHaveBeenCalledWith(
        expect.stringContaining('FROM course_assignments'),
        expect.anything(),
      );
    });

    it('throws ValidationError when time block does not match school config', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockScheduleConfigRepo.timeBlockExists.mockResolvedValueOnce(false);
      await expect(
        service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('passes schoolId + startTime + endTime to scheduleConfigRepo.timeBlockExists', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      await service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto);
      expect(mockScheduleConfigRepo.timeBlockExists).toHaveBeenCalledWith(
        SCHOOL_ID, '08:00', '10:00',
      );
    });

    it('creates the slot inside a transaction', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      await service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
      expect(mockTimetableRepo.create).toHaveBeenCalledWith(mockMgr, SCHOOL_ID, createDto);
    });

    it('returns the created slot with nextSessionId appended', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockMgr.query
        .mockResolvedValueOnce([])              // academic year → skip sessions
        .mockResolvedValueOnce([{ id: 'next-session' }]); // nextSessionId
      const result = await service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto);
      expect(result).toMatchObject({ ...fakeSlot, nextSessionId: 'next-session' });
    });

    it('sets nextSessionId to null when no upcoming session exists', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockMgr.query
        .mockResolvedValueOnce([])  // academic year → skip
        .mockResolvedValueOnce([]); // no next session
      const result = await service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], createDto);
      expect(result.nextSessionId).toBeNull();
    });

    it('validates venue exists and checks conflict when venue is provided', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      await service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], { ...createDto, venue: VENUE_ID });
      expect(mockVenuesRepo.findById).toHaveBeenCalledWith(VENUE_ID, SCHOOL_ID);
      expect(mockTimetableRepo.checkConflict).toHaveBeenCalled();
    });

    it('throws ConflictError when venue is already booked at that time', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockTimetableRepo.checkConflict.mockResolvedValueOnce(true);
      await expect(
        service.create(SCHOOL_ID, ACTOR_ID, ['lecturer'], { ...createDto, venue: VENUE_ID }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  // ─── update() ─────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('throws NotFoundError when slot does not exist', async () => {
      mockTimetableRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], { startTime: '09:00' }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('checks lecturer ownership using the existing slot courseAssignmentId', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      await service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], {});
      expect(mockDs.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM course_assignments'),
        [CA_ID, SCHOOL_ID],
      );
    });

    it('throws ForbiddenError when lecturer does not own the slot', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: OTHER_ID }]);
      await expect(
        service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], {}),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('validates time block when dto contains startTime', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockScheduleConfigRepo.timeBlockExists.mockResolvedValueOnce(false);
      await expect(
        service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], { startTime: '09:00' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('validates time block when dto contains endTime', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockScheduleConfigRepo.timeBlockExists.mockResolvedValueOnce(false);
      await expect(
        service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], { endTime: '11:00' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('skips time block check when dto has no time fields', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      await service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], { venue: VENUE_ID });
      expect(mockScheduleConfigRepo.timeBlockExists).not.toHaveBeenCalled();
    });

    it('skips ownership check for admin role', async () => {
      await service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['admin'], {});
      expect(mockDs.query).not.toHaveBeenCalledWith(
        expect.stringContaining('FROM course_assignments'),
        expect.anything(),
      );
    });

    it('delegates final update to timetableRepository.update inside transaction', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      await service.update(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer'], {});
      expect(mockTimetableRepo.update).toHaveBeenCalled();
    });
  });

  // ─── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    beforeEach(() => {
      // Successful delete: DELETE returns [[], 1]
      mockMgr.query
        .mockResolvedValueOnce([])    // DELETE future sessions
        .mockResolvedValueOnce([])    // NULL out timetable_slot_id FK
        .mockResolvedValueOnce([[], 1]); // DELETE slot (1 row affected)
    });

    it('throws NotFoundError when slot does not exist', async () => {
      mockTimetableRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.remove(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer']),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ForbiddenError when lecturer does not own the slot', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: OTHER_ID }]);
      await expect(
        service.remove(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer']),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('skips ownership check for admin role', async () => {
      await service.remove(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['admin']);
      expect(mockDs.query).not.toHaveBeenCalledWith(
        expect.stringContaining('FROM course_assignments'),
        expect.anything(),
      );
    });

    it('deletes future sessions before removing the slot', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockMgr.query.mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[], 1]);
      await service.remove(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer']);
      expect(mockMgr.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'scheduled'"),
        [SLOT_ID],
      );
    });

    it('nullifies timetable_slot_id on orphaned sessions before deleting slot', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockMgr.query.mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[], 1]);
      await service.remove(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer']);
      expect(mockMgr.query).toHaveBeenCalledWith(
        expect.stringContaining('SET timetable_slot_id = NULL'),
        [SLOT_ID],
      );
    });

    it('returns { success: true } on successful deletion', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockMgr.query.mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[], 1]);
      const result = await service.remove(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer']);
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundError when DELETE affects 0 rows', async () => {
      mockDs.query.mockResolvedValueOnce([{ lecturerUserId: ACTOR_ID }]);
      mockMgr.query.mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[], 0]); // 0 rows affected
      await expect(
        service.remove(SCHOOL_ID, SLOT_ID, ACTOR_ID, ['lecturer']),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
