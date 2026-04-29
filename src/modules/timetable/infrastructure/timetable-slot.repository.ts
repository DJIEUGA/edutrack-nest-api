import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimetableSlot } from '../domain/timetable-slot.entity';

@Injectable()
export class TimetableSlotRepository {
  constructor(
    @InjectRepository(TimetableSlot)
    private readonly repo: Repository<TimetableSlot>,
  ) {}

  findById(id: string): Promise<TimetableSlot | null> {
    return this.repo.findOne({ where: { id } });
  }

  list(schoolId: string, filters: { academicYearId?: string; courseAssignmentId?: string } = {}) {
    const where: Record<string, unknown> = { schoolId };
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.courseAssignmentId) where.courseAssignmentId = filters.courseAssignmentId;
    return this.repo.find({ where, order: { dayOfWeek: 'ASC', startTime: 'ASC' } });
  }

  listByCourseAssignment(courseAssignmentId: string): Promise<TimetableSlot[]> {
    return this.repo.find({
      where: { courseAssignmentId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
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
    return this.repo.save(this.repo.create(input));
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
