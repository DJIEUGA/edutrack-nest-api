import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class SessionsPublicService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async transitionToPendingConfirmation(
    slotIds: string[],
    weekStart: string,
    weekEnd: string,
    schoolId: string,
  ): Promise<void> {
    if (slotIds.length === 0) return;
    const placeholders = slotIds.map((_, i) => `$${i + 4}`).join(', ');
    await this.dataSource.query(
      `UPDATE sessions
       SET status = 'pending_confirmation', updated_at = NOW()
       WHERE school_id = $1
         AND scheduled_date BETWEEN $2 AND $3
         AND timetable_slot_id IN (${placeholders})
         AND status = 'scheduled'`,
      [schoolId, weekStart, weekEnd, ...slotIds],
    );
  }

  async transitionToScheduled(
    slotId: string,
    weekStart: string,
    weekEnd: string,
    schoolId: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions
       SET status = 'scheduled', updated_at = NOW()
       WHERE school_id = $1
         AND timetable_slot_id = $2
         AND scheduled_date BETWEEN $3 AND $4
         AND status = 'pending_confirmation'`,
      [schoolId, slotId, weekStart, weekEnd],
    );
  }

  async cancelFutureSessionsFromDate(
    slotId: string,
    fromDate: string,
    schoolId: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions
       SET status = 'cancelled', updated_at = NOW()
       WHERE school_id = $1
         AND timetable_slot_id = $2
         AND scheduled_date >= $3
         AND status IN ('scheduled', 'pending_confirmation')`,
      [schoolId, slotId, fromDate],
    );
  }

  // Updates scheduledDate and promotes status to 'scheduled' for a single session instance.
  async rescheduleSession(
    sessionId: string,
    newDate: string,
    schoolId: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions
       SET scheduled_date = $1, status = 'scheduled', updated_at = NOW()
       WHERE id = $2 AND school_id = $3 AND status = 'pending_confirmation'`,
      [newDate, sessionId, schoolId],
    );
  }

  async cancelOneSession(sessionId: string, schoolId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND school_id = $2 AND status IN ('pending_confirmation', 'scheduled')`,
      [sessionId, schoolId],
    );
  }

  // Used by the reconciliation job: cancels pending_confirmation sessions in a date
  // range without needing the slot ID (handles the case where FK was already nulled).
  async cancelOrphanedPendingConfirmationSessions(
    schoolId: string,
    weekStart: string,
    weekEnd: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions
       SET status = 'cancelled', updated_at = NOW()
       WHERE school_id = $1
         AND status = 'pending_confirmation'
         AND scheduled_date BETWEEN $2 AND $3`,
      [schoolId, weekStart, weekEnd],
    );
  }
}
