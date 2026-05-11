import { Injectable } from '@nestjs/common';
// Avoid importing 'typeorm' types at runtime in this temp context — provide a lightweight alias
// to satisfy typings when the 'typeorm' package/types are not available.
type DataSource = any;
import { InjectDataSource } from '@nestjs/typeorm';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { TimetableRepository } from '../infrastructure/timetable.repository';
import { VenuesRepository } from '../../schools/infrastructure/venues.repository';

interface CreateTimetableDto {
  academicYearId: string;
  courseAssignmentId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  venue?: string;
}

interface UpdateTimetableDto {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  venue?: string;
}

interface ListResponse {
  [key: string]: any;
}

interface RemoveResponse {
  success: boolean;
}

@Injectable()
export class TimetableService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly timetableRepository: TimetableRepository,
    private readonly venuesRepository: VenuesRepository,
  ) {}

  async list(schoolId: string, academicYearId?: string) {
    return this.timetableRepository.list(schoolId, academicYearId);
  }

  async create(schoolId: string, dto: {
    academicYearId: string;
    courseAssignmentId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    venue?: string;
  }) {
    return await this.dataSource.transaction(async (manager: any) => {
      // Section 14.4: Conflict Detection (Venue/Time overlap)
      if (dto.venue) {
        // Validate that the venue is managed in the school's venues repository
        const venueExists = await this.venuesRepository.findByName(dto.venue, schoolId);
        if (!venueExists) {
          throw new Error(`Venue "${dto.venue}" is not registered. Please create it in the Venues settings first.`);
        }

        const hasConflict = await this.timetableRepository.checkConflict(
          manager,
          schoolId,
          dto.dayOfWeek,
          dto.venue,
          dto.startTime,
          dto.endTime,
        );
        if (hasConflict) {
          throw new ConflictError(`Venue ${dto.venue} is already booked for this time slot`, { code: 'TIMETABLE_CONFLICT' });
        }
      }

      return this.timetableRepository.create(manager, schoolId, dto as any); // Cast to any as dto might not perfectly match repo's internal type
    });
  }

  async update(schoolId: string, id: string, dto: { dayOfWeek?: number; startTime?: string; endTime?: string; venue?: string }) {
    return await this.dataSource.transaction(async (manager: any) => {
      const existing = await this.timetableRepository.findById(id, schoolId);
      if (!existing) throw new NotFoundError('Timetable slot not found');

      const dayOfWeek = dto.dayOfWeek !== undefined ? dto.dayOfWeek : existing.day_of_week;
      const startTime = dto.startTime !== undefined ? dto.startTime : existing.start_time;
      const endTime = dto.endTime !== undefined ? dto.endTime : existing.end_time;
      const venue = dto.venue !== undefined ? dto.venue : existing.venue;

      if (venue) {
        // Validate that the venue is managed in the school's venues repository
        const venueExists = await this.venuesRepository.findByName(venue, schoolId);
        if (!venueExists) {
          throw new Error(`Venue "${venue}" is not registered. Please create it in the Venues settings first.`);
        }

        const hasConflict = await this.timetableRepository.checkConflict(
          manager,
          schoolId,
          dayOfWeek,
          venue,
          startTime,
          endTime,
          id,
        );
        if (hasConflict) {
          throw new ConflictError(`Venue ${venue} is already booked for this time slot`, { code: 'TIMETABLE_CONFLICT' });
        }
      }

      return this.timetableRepository.update(manager, id, schoolId, { dayOfWeek, startTime, endTime, venue } as any); // Cast to any
    });
  }

  async remove(schoolId: string, id: string) {
    const success = await this.timetableRepository.delete(id, schoolId);
    if (!success) throw new NotFoundError('Timetable slot not found');
    return { success: true };
  }
}