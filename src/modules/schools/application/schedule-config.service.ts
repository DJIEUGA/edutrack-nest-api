import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@common/errors/domain.errors';
import { ScheduleConfigRepository } from '../infrastructure/schedule-config.repository';

@Injectable()
export class ScheduleConfigService {
  constructor(private readonly repo: ScheduleConfigRepository) {}

  async getConfig(schoolId: string) {
    const [days, timeBlocks] = await Promise.all([
      this.repo.getScheduleDays(schoolId),
      this.repo.getTimeBlocks(schoolId),
    ]);
    return { days, timeBlocks };
  }

  async addTimeBlock(schoolId: string, dto: { label?: string; startTime: string; endTime: string }) {
    if (dto.startTime >= dto.endTime) {
      throw new ValidationError('startTime must be before endTime');
    }
    return this.repo.addTimeBlock(schoolId, dto);
  }

  async deleteTimeBlock(schoolId: string, blockId: string) {
    const deleted = await this.repo.deleteTimeBlock(blockId, schoolId);
    if (!deleted) throw new NotFoundError('Time block not found');
    return { success: true };
  }

  async setScheduleDays(schoolId: string, days: number[]) {
    const unique = [...new Set(days)];
    await this.repo.setScheduleDays(schoolId, unique);
    return { days: unique.sort((a, b) => a - b) };
  }
}
