import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface SlotSummary {
  id: string;
  lecturerUserId: string;
  courseAssignmentId: string;
  academicYearId: string;
  dayOfWeek: number;
}

export interface SchoolTimezone {
  id: string;
  timezone: string;
}

export interface OrphanedResetSummary {
  slotPromotionId: string;
  timetableSlotId: string;
  schoolId: string;
  weekStart: string;
  weekEnd: string;
  slotStillExists: boolean;
  hasPendingConfirmationSessions: boolean;
}

@Injectable()
export class PromotionReadRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findSchoolTimezone(schoolId: string): Promise<SchoolTimezone | null> {
    const [row] = await this.dataSource.query(
      `SELECT id, COALESCE(timezone, 'UTC') as timezone FROM schools WHERE id = $1`,
      [schoolId],
    );
    return row || null;
  }

  async findAllSchoolTimezones(): Promise<SchoolTimezone[]> {
    return this.dataSource.query(
      `SELECT id, COALESCE(timezone, 'UTC') as timezone FROM schools WHERE status = 'active'`,
    );
  }

  async findActiveAcademicYear(schoolId: string) {
    const [row] = await this.dataSource.query(
      `SELECT id, start_date as "startDate", end_date as "endDate"
       FROM academic_years
       WHERE school_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [schoolId],
    );
    return row || null;
  }

  async findActiveSlotsForSchool(schoolId: string, academicYearId: string): Promise<SlotSummary[]> {
    return this.dataSource.query(
      `SELECT ts.id, ca.lecturer_user_id as "lecturerUserId",
              ts.course_assignment_id as "courseAssignmentId",
              ts.academic_year_id as "academicYearId",
              ts.day_of_week as "dayOfWeek"
       FROM timetable_slots ts
       JOIN course_assignments ca ON ca.id = ts.course_assignment_id
       WHERE ts.school_id = $1 AND ts.academic_year_id = $2`,
      [schoolId, academicYearId],
    );
  }

  async slotHasSessionsInWeek(slotId: string, weekStart: string, weekEnd: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT 1 FROM sessions
       WHERE timetable_slot_id = $1
         AND scheduled_date BETWEEN $2 AND $3
         AND status IN ('scheduled', 'pending_confirmation')
       LIMIT 1`,
      [slotId, weekStart, weekEnd],
    );
    return !!row;
  }

  // Finds SlotPromotions marked as reset where either:
  //   (a) the timetable slot still exists (slot deletion failed), or
  //   (b) sessions are still in pending_confirmation past the cycle weekEnd
  async findOrphanedResets(): Promise<OrphanedResetSummary[]> {
    return this.dataSource.query(
      `SELECT
         sp.id                                           AS "slotPromotionId",
         sp.timetable_slot_id                            AS "timetableSlotId",
         sp.school_id                                    AS "schoolId",
         pc.week_start                                   AS "weekStart",
         pc.week_end                                     AS "weekEnd",
         (ts.id IS NOT NULL)                             AS "slotStillExists",
         EXISTS (
           SELECT 1 FROM sessions s
           WHERE s.timetable_slot_id = sp.timetable_slot_id
             AND s.status = 'pending_confirmation'
             AND s.scheduled_date >= pc.week_start
         )                                               AS "hasPendingConfirmationSessions"
       FROM slot_promotions sp
       JOIN promotion_cycles pc ON pc.id = sp.promotion_cycle_id
       LEFT JOIN timetable_slots ts ON ts.id = sp.timetable_slot_id
       WHERE sp.status = 'reset'
         AND (
           ts.id IS NOT NULL
           OR EXISTS (
             SELECT 1 FROM sessions s
             WHERE s.timetable_slot_id = sp.timetable_slot_id
               AND s.status = 'pending_confirmation'
               AND s.scheduled_date >= pc.week_start
           )
         )`,
    );
  }
}
