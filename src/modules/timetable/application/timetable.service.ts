import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { buildCourseAssignmentScope } from '@common/scope/course-assignment-scope';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { TimetableRepository } from '../infrastructure/timetable.repository';
import { VenuesRepository } from '../../schools/infrastructure/venues.repository';

@Injectable()
export class TimetableService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly timetableRepository: TimetableRepository,
    private readonly venuesRepository: VenuesRepository,
    private readonly roleResolver: RoleResolverService,
  ) {}

  async list(schoolId: string, actorId: string, academicYearId?: string) {
    const roles = await this.roleResolver.listRolesForUser(actorId, schoolId);
    // $1 = schoolId, $2 = academicYearId — scope starts at $3
    const scope = buildCourseAssignmentScope(roles, actorId, schoolId, 3);
    return this.timetableRepository.list(schoolId, academicYearId, scope);
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
      if (dto.venue) {
        const venueExists = await this.venuesRepository.findById(dto.venue, schoolId);
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

      const slot = await this.timetableRepository.create(manager, schoolId, dto as any);

      await this.generateSessionsForSlot(
        manager,
        slot.id,
        schoolId,
        dto.courseAssignmentId,
        dto.academicYearId,
        dto.dayOfWeek,
      );

      const [next] = await manager.query(
        `SELECT id FROM sessions
         WHERE timetable_slot_id = $1 AND scheduled_date >= CURRENT_DATE AND status = 'scheduled'
         ORDER BY scheduled_date ASC LIMIT 1`,
        [slot.id],
      );

      return { ...slot, nextSessionId: next?.id ?? null };
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
        const venueExists = await this.venuesRepository.findById(venue, schoolId);
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

      return this.timetableRepository.update(manager, id, schoolId, { dayOfWeek, startTime, endTime, venue } as any);
    });
  }

  async remove(schoolId: string, id: string) {
    return await this.dataSource.transaction(async (manager: any) => {
      // Delete future scheduled sessions so the slot FK can be cleared
      await manager.query(
        `DELETE FROM sessions
         WHERE timetable_slot_id = $1 AND status = 'scheduled' AND scheduled_date >= CURRENT_DATE`,
        [id],
      );

      // Orphan past sessions (completed/live/cancelled) so the slot row can be deleted
      await manager.query(
        `UPDATE sessions SET timetable_slot_id = NULL WHERE timetable_slot_id = $1`,
        [id],
      );

      const result = await manager.query(
        `DELETE FROM timetable_slots WHERE id = $1 AND school_id = $2`,
        [id, schoolId],
      );

      if (result[1] === 0) throw new NotFoundError('Timetable slot not found');
      return { success: true };
    });
  }

  // Generates one session row per occurrence of dayOfWeek within the academic year.
  // dayOfWeek follows JS convention: 0 = Sunday, 1 = Monday, …, 6 = Saturday.
  private async generateSessionsForSlot(
    manager: any,
    slotId: string,
    schoolId: string,
    courseAssignmentId: string,
    academicYearId: string,
    dayOfWeek: number,
  ): Promise<void> {
    const [year] = await manager.query(
      `SELECT start_date as "startDate", end_date as "endDate"
       FROM academic_years WHERE id = $1 AND school_id = $2`,
      [academicYearId, schoolId],
    );
    if (!year) return;

    const start = new Date(year.startDate);
    const end = new Date(year.endDate);

    // Advance start to the first matching weekday
    const daysToAdd = (dayOfWeek - start.getUTCDay() + 7) % 7;
    start.setUTCDate(start.getUTCDate() + daysToAdd);

    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    if (dates.length === 0) return;

    // Bulk insert: $1 = school_id, $2 = course_assignment_id, $3 = slot_id, $4… = dates
    const placeholders = dates
      .map((_, i) => `($1, $2, $3, $${i + 4}, 'scheduled')`)
      .join(', ');

    await manager.query(
      `INSERT INTO sessions (school_id, course_assignment_id, timetable_slot_id, scheduled_date, status)
       VALUES ${placeholders}`,
      [schoolId, courseAssignmentId, slotId, ...dates],
    );
  }
}
