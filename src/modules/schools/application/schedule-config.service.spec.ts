import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleConfigService } from './schedule-config.service';
import { ScheduleConfigRepository } from '../infrastructure/schedule-config.repository';
import { NotFoundError, ValidationError } from '@common/errors/domain.errors';

const SCHOOL_ID  = 'aaaaaaaa-0000-0000-0000-000000000001';
const BLOCK_ID   = 'bbbbbbbb-0000-0000-0000-000000000002';

const fakeBlock = {
  id: BLOCK_ID,
  schoolId: SCHOOL_ID,
  label: 'Morning 1',
  startTime: '08:00',
  endTime: '10:00',
};

describe('ScheduleConfigService', () => {
  let service: ScheduleConfigService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      getScheduleDays: jest.fn(),
      getTimeBlocks:   jest.fn(),
      addTimeBlock:    jest.fn(),
      deleteTimeBlock: jest.fn(),
      setScheduleDays: jest.fn(),
    };
    mockRepo.getScheduleDays.mockResolvedValue([1, 2, 3, 4, 5]);
    mockRepo.getTimeBlocks.mockResolvedValue([fakeBlock]);
    mockRepo.addTimeBlock.mockResolvedValue(fakeBlock);
    mockRepo.deleteTimeBlock.mockResolvedValue(true);
    mockRepo.setScheduleDays.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleConfigService,
        { provide: ScheduleConfigRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ScheduleConfigService>(ScheduleConfigService);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  // ─── getConfig() ──────────────────────────────────────────────────────────

  describe('getConfig()', () => {
    it('returns days and timeBlocks together', async () => {
      const result = await service.getConfig(SCHOOL_ID);
      expect(result).toEqual({ days: [1, 2, 3, 4, 5], timeBlocks: [fakeBlock] });
    });

    it('passes schoolId to both repo methods', async () => {
      await service.getConfig(SCHOOL_ID);
      expect(mockRepo.getScheduleDays).toHaveBeenCalledWith(SCHOOL_ID);
      expect(mockRepo.getTimeBlocks).toHaveBeenCalledWith(SCHOOL_ID);
    });

    it('returns empty arrays when school has no config yet', async () => {
      mockRepo.getScheduleDays.mockResolvedValue([]);
      mockRepo.getTimeBlocks.mockResolvedValue([]);
      const result = await service.getConfig(SCHOOL_ID);
      expect(result).toEqual({ days: [], timeBlocks: [] });
    });
  });

  // ─── addTimeBlock() ───────────────────────────────────────────────────────

  describe('addTimeBlock()', () => {
    it('throws ValidationError when startTime equals endTime', async () => {
      await expect(
        service.addTimeBlock(SCHOOL_ID, { startTime: '08:00', endTime: '08:00' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when startTime is after endTime', async () => {
      await expect(
        service.addTimeBlock(SCHOOL_ID, { startTime: '10:00', endTime: '08:00' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('delegates to repo when times are valid', async () => {
      await service.addTimeBlock(SCHOOL_ID, { startTime: '08:00', endTime: '10:00', label: 'M1' });
      expect(mockRepo.addTimeBlock).toHaveBeenCalledWith(SCHOOL_ID, {
        startTime: '08:00',
        endTime: '10:00',
        label: 'M1',
      });
    });

    it('returns the created block from the repo', async () => {
      const result = await service.addTimeBlock(SCHOOL_ID, { startTime: '08:00', endTime: '10:00' });
      expect(result).toEqual(fakeBlock);
    });

    it('does not call repo when validation fails', async () => {
      await expect(
        service.addTimeBlock(SCHOOL_ID, { startTime: '10:00', endTime: '09:00' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockRepo.addTimeBlock).not.toHaveBeenCalled();
    });
  });

  // ─── deleteTimeBlock() ────────────────────────────────────────────────────

  describe('deleteTimeBlock()', () => {
    it('returns { success: true } when block is deleted', async () => {
      const result = await service.deleteTimeBlock(SCHOOL_ID, BLOCK_ID);
      expect(result).toEqual({ success: true });
    });

    it('passes blockId and schoolId to repo in correct order', async () => {
      await service.deleteTimeBlock(SCHOOL_ID, BLOCK_ID);
      expect(mockRepo.deleteTimeBlock).toHaveBeenCalledWith(BLOCK_ID, SCHOOL_ID);
    });

    it('throws NotFoundError when repo returns false (block not found)', async () => {
      mockRepo.deleteTimeBlock.mockResolvedValue(false);
      await expect(service.deleteTimeBlock(SCHOOL_ID, BLOCK_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ─── setScheduleDays() ────────────────────────────────────────────────────

  describe('setScheduleDays()', () => {
    it('delegates to repo.setScheduleDays with schoolId and deduped days', async () => {
      await service.setScheduleDays(SCHOOL_ID, [1, 2, 3, 2, 1]);
      expect(mockRepo.setScheduleDays).toHaveBeenCalledWith(SCHOOL_ID, expect.arrayContaining([1, 2, 3]));
      const passedDays = (mockRepo.setScheduleDays as jest.Mock).mock.calls[0][1] as number[];
      expect(passedDays).toHaveLength(3);
    });

    it('returns sorted unique days', async () => {
      const result = await service.setScheduleDays(SCHOOL_ID, [5, 1, 3, 1]);
      expect(result).toEqual({ days: [1, 3, 5] });
    });

    it('accepts an empty array and delegates empty set to repo', async () => {
      const result = await service.setScheduleDays(SCHOOL_ID, []);
      expect(mockRepo.setScheduleDays).toHaveBeenCalledWith(SCHOOL_ID, []);
      expect(result).toEqual({ days: [] });
    });

    it('handles already-unique days without modification', async () => {
      const result = await service.setScheduleDays(SCHOOL_ID, [1, 2, 3]);
      expect(result).toEqual({ days: [1, 2, 3] });
    });
  });
});
