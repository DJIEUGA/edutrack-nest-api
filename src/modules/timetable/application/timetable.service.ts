import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@common/errors/domain.errors';
import { TimetableSlot } from '../domain/timetable-slot.entity';
import { TimetableSlotRepository } from '../infrastructure/timetable-slot.repository';

@Injectable()
export class TimetableService {
  constructor(private readonly slots: TimetableSlotRepository) {}

  list(
    schoolId: string,
    filters: { academicYearId?: string; courseAssignmentId?: string } = {},
  ): Promise<TimetableSlot[]> {
    return this.slots.list(schoolId, filters);
  }

  async getById(schoolId: string, id: string): Promise<TimetableSlot> {
    const slot = await this.slots.findById(id);
    if (!slot || slot.schoolId !== schoolId) {
      throw new NotFoundError('Timetable slot not found', { id });
    }
    return slot;
  }

  create(input: {
    schoolId: string;
    academicYearId: string;
    courseAssignmentId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    venue?: string | null;
  }): Promise<TimetableSlot> {
    return this.slots.create(input);
  }

  async remove(schoolId: string, id: string): Promise<void> {
    await this.getById(schoolId, id);
    await this.slots.delete(id);
  }
}
