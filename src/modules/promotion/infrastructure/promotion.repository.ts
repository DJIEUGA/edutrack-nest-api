import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PromotionCycleStatus } from '../domain/promotion-cycle.entity';
import { SlotPromotionStatus } from '../domain/slot-promotion.entity';

export interface CreateCyclePayload {
  schoolId: string;
  weekStart: string;
  weekEnd: string;
  triggeredBy: string;
  triggeredAt: Date;
}

export interface CreateSlotPromotionPayload {
  promotionCycleId: string;
  timetableSlotId: string;
  lecturerUserId: string;
  schoolId: string;
}

export interface CreateReminderPayload {
  promotionCycleId: string;
  lecturerUserId: string;
  schoolId: string;
  message: string;
  sentAt: Date;
}

@Injectable()
export class PromotionRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createCycle(payload: CreateCyclePayload) {
    const [cycle] = await this.dataSource.query(
      `INSERT INTO promotion_cycles
         (school_id, week_start, week_end, triggered_by, triggered_at, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, school_id as "schoolId", week_start as "weekStart",
                 week_end as "weekEnd", triggered_by as "triggeredBy",
                 triggered_at as "triggeredAt", status, created_at as "createdAt"`,
      [payload.schoolId, payload.weekStart, payload.weekEnd, payload.triggeredBy, payload.triggeredAt],
    );
    return cycle;
  }

  async findCycleBySchoolAndWeek(schoolId: string, weekStart: string) {
    const [cycle] = await this.dataSource.query(
      `SELECT id, school_id as "schoolId", week_start as "weekStart",
              week_end as "weekEnd", triggered_by as "triggeredBy",
              triggered_at as "triggeredAt", status, created_at as "createdAt"
       FROM promotion_cycles
       WHERE school_id = $1 AND week_start = $2`,
      [schoolId, weekStart],
    );
    return cycle || null;
  }

  async findCycleById(cycleId: string) {
    const [cycle] = await this.dataSource.query(
      `SELECT id, school_id as "schoolId", week_start as "weekStart",
              week_end as "weekEnd", triggered_by as "triggeredBy",
              triggered_at as "triggeredAt", status, created_at as "createdAt"
       FROM promotion_cycles WHERE id = $1`,
      [cycleId],
    );
    return cycle || null;
  }

  async listCyclesForSchool(schoolId: string) {
    return this.dataSource.query(
      `SELECT pc.id, pc.week_start as "weekStart", pc.week_end as "weekEnd",
              pc.status, pc.triggered_at as "triggeredAt",
              COUNT(sp.id) FILTER (WHERE sp.status = 'pending')   AS "pendingCount",
              COUNT(sp.id) FILTER (WHERE sp.status = 'confirmed') AS "confirmedCount",
              COUNT(sp.id) FILTER (WHERE sp.status = 'modified')  AS "modifiedCount",
              COUNT(sp.id) FILTER (WHERE sp.status = 'reset')     AS "resetCount"
       FROM promotion_cycles pc
       LEFT JOIN slot_promotions sp ON sp.promotion_cycle_id = pc.id
       WHERE pc.school_id = $1
       GROUP BY pc.id
       ORDER BY pc.week_start DESC`,
      [schoolId],
    );
  }

  async getCycleDetail(cycleId: string, schoolId: string) {
    return this.dataSource.query(
      `SELECT sp.id, sp.timetable_slot_id as "timetableSlotId",
              sp.lecturer_user_id as "lecturerUserId", sp.status,
              sp.confirmed_at as "confirmedAt", sp.reset_at as "resetAt",
              p.full_name as "lecturerName",
              c.title as "courseTitle", ts.day_of_week as "dayOfWeek",
              ts.start_time as "startTime", ts.end_time as "endTime"
       FROM slot_promotions sp
       JOIN timetable_slots ts ON ts.id = sp.timetable_slot_id
       JOIN course_assignments ca ON ca.id = ts.course_assignment_id
       JOIN courses c ON c.id = ca.course_id
       JOIN profiles p ON p.id = sp.lecturer_user_id
       WHERE sp.promotion_cycle_id = $1 AND sp.school_id = $2
       ORDER BY p.full_name, ts.day_of_week, ts.start_time`,
      [cycleId, schoolId],
    );
  }

  async updateCycleStatus(cycleId: string, status: PromotionCycleStatus): Promise<void> {
    await this.dataSource.query(
      `UPDATE promotion_cycles SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, cycleId],
    );
  }

  async findActiveCyclesForSchool(schoolId: string) {
    return this.dataSource.query(
      `SELECT id, school_id as "schoolId", week_start as "weekStart",
              week_end as "weekEnd", status
       FROM promotion_cycles
       WHERE school_id = $1 AND status = 'active'`,
      [schoolId],
    );
  }

  async createSlotPromotions(payloads: CreateSlotPromotionPayload[]): Promise<void> {
    if (payloads.length === 0) return;
    const values = payloads
      .map((_, i) => {
        const base = i * 4;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, 'pending')`;
      })
      .join(', ');
    const params = payloads.flatMap((p) => [
      p.promotionCycleId,
      p.timetableSlotId,
      p.lecturerUserId,
      p.schoolId,
    ]);
    await this.dataSource.query(
      `INSERT INTO slot_promotions
         (promotion_cycle_id, timetable_slot_id, lecturer_user_id, school_id, status)
       VALUES ${values}
       ON CONFLICT (promotion_cycle_id, timetable_slot_id) DO NOTHING`,
      params,
    );
  }

  async findSlotPromotion(slotPromotionId: string, schoolId: string) {
    const [sp] = await this.dataSource.query(
      `SELECT id, promotion_cycle_id as "promotionCycleId",
              timetable_slot_id as "timetableSlotId", lecturer_user_id as "lecturerUserId",
              school_id as "schoolId", status, confirmed_at as "confirmedAt"
       FROM slot_promotions WHERE id = $1 AND school_id = $2`,
      [slotPromotionId, schoolId],
    );
    return sp || null;
  }

  async findMySlotPromotionsForCycle(cycleId: string, lecturerUserId: string) {
    return this.dataSource.query(
      `SELECT sp.id, sp.timetable_slot_id as "timetableSlotId", sp.status,
              sp.confirmed_at as "confirmedAt",
              ts.day_of_week as "dayOfWeek", ts.start_time as "startTime",
              ts.end_time as "endTime", ts.venue,
              c.title as "courseTitle", c.code as "courseCode",
              cl.name as "className"
       FROM slot_promotions sp
       JOIN timetable_slots ts ON ts.id = sp.timetable_slot_id
       JOIN course_assignments ca ON ca.id = ts.course_assignment_id
       JOIN courses c ON c.id = ca.course_id
       JOIN classes cl ON cl.id = ca.class_id
       WHERE sp.promotion_cycle_id = $1 AND sp.lecturer_user_id = $2
       ORDER BY ts.day_of_week, ts.start_time`,
      [cycleId, lecturerUserId],
    );
  }

  async updateSlotPromotionStatus(
    slotPromotionId: string,
    status: SlotPromotionStatus,
    confirmedAt: Date | null,
    resetAt?: Date | null,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE slot_promotions
       SET status = $1, confirmed_at = $2, reset_at = $3, updated_at = NOW()
       WHERE id = $4`,
      [status, confirmedAt, resetAt ?? null, slotPromotionId],
    );
  }

  async findPendingSlotPromotionsForCycle(cycleId: string) {
    return this.dataSource.query(
      `SELECT id, timetable_slot_id as "timetableSlotId",
              lecturer_user_id as "lecturerUserId", school_id as "schoolId"
       FROM slot_promotions
       WHERE promotion_cycle_id = $1 AND status = 'pending'`,
      [cycleId],
    );
  }

  async createReminders(payloads: CreateReminderPayload[]): Promise<void> {
    if (payloads.length === 0) return;
    const values = payloads
      .map((_, i) => {
        const base = i * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, FALSE)`;
      })
      .join(', ');
    const params = payloads.flatMap((p) => [
      p.promotionCycleId,
      p.lecturerUserId,
      p.schoolId,
      p.message,
      p.sentAt,
    ]);
    await this.dataSource.query(
      `INSERT INTO promotion_reminders
         (promotion_cycle_id, lecturer_user_id, school_id, message, sent_at, is_read)
       VALUES ${values}`,
      params,
    );
  }

  async findUnreadRemindersForLecturer(lecturerUserId: string, schoolId: string) {
    return this.dataSource.query(
      `SELECT id, promotion_cycle_id as "promotionCycleId", message,
              sent_at as "sentAt", is_read as "isRead", created_at as "createdAt"
       FROM promotion_reminders
       WHERE lecturer_user_id = $1 AND school_id = $2 AND is_read = FALSE
       ORDER BY sent_at DESC`,
      [lecturerUserId, schoolId],
    );
  }

  async markReminderRead(reminderId: string, lecturerUserId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE promotion_reminders
       SET is_read = TRUE
       WHERE id = $1 AND lecturer_user_id = $2`,
      [reminderId, lecturerUserId],
    );
  }

  async findLecturersWithPendingSlotsForCycle(cycleId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT lecturer_user_id as "lecturerUserId"
       FROM slot_promotions
       WHERE promotion_cycle_id = $1 AND status = 'pending'`,
      [cycleId],
    );
    return rows.map((r: { lecturerUserId: string }) => r.lecturerUserId);
  }
}
