import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getDay, getHours, getMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { SessionsPublicService } from '@modules/sessions/application/sessions-public.service';
import { TimetablePublicService } from '@modules/timetable/application/timetable-public.service';
import { PromotionRepository } from '../infrastructure/promotion.repository';
import { PromotionReadRepository } from '../infrastructure/promotion-read.repository';

const REMINDER_DAYS = [4, 5, 6]; // Thursday, Friday, Saturday
const REMINDER_HOUR = 8;
const RESET_DAY = 0; // Sunday
const RESET_HOUR = 12;

@Injectable()
export class PromotionSchedulerService {
  private readonly logger = new Logger(PromotionSchedulerService.name);

  constructor(
    private readonly promotionRepo: PromotionRepository,
    private readonly promotionReadRepo: PromotionReadRepository,
    private readonly sessionsPublicService: SessionsPublicService,
    private readonly timetablePublicService: TimetablePublicService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleDailyReminders(): Promise<void> {
    const now = new Date();
    const schools = await this.promotionReadRepo.findAllSchoolTimezones();

    for (const school of schools) {
      try {
        const local = toZonedTime(now, school.timezone);
        if (!REMINDER_DAYS.includes(getDay(local))) continue;
        if (getHours(local) !== REMINDER_HOUR) continue;

        const cycles = await this.promotionRepo.findActiveCyclesForSchool(school.id);
        for (const cycle of cycles) {
          await this.sendRemindersForCycle(cycle, school.id);
        }
      } catch (err) {
        this.logger.error(`Reminder job failed for school ${school.id}: ${(err as Error).message}`);
      }
    }
  }

  // Sends an immediate reminder for all lecturers with pending slots in a cycle.
  // Called both by the cron and directly from PromotionService on HOD trigger.
  async sendRemindersForCycle(cycle: { id: string; weekStart: string; weekEnd: string }, schoolId: string): Promise<void> {
    const lecturers = await this.promotionRepo.findLecturersWithPendingSlotsForCycle(cycle.id);
    if (lecturers.length === 0) return;

    await this.promotionRepo.createReminders(
      lecturers.map((lecturerUserId) => ({
        promotionCycleId: cycle.id,
        lecturerUserId,
        schoolId,
        message: `Reminder: confirm your timetable for week ${cycle.weekStart} – ${cycle.weekEnd}. Deadline is Sunday noon.`,
        sentAt: new Date(),
      })),
    );
  }

  // Runs every 30 minutes. For each school whose local time is Sunday 12:00–12:29,
  // resets all PENDING slot promotions and closes the cycle.
  @Cron('0,30 * * * *')
  async handleWeeklyReset(): Promise<void> {
    const now = new Date();
    const schools = await this.promotionReadRepo.findAllSchoolTimezones();

    for (const school of schools) {
      try {
        const local = toZonedTime(now, school.timezone);
        if (getDay(local) !== RESET_DAY) continue;
        if (getHours(local) !== RESET_HOUR) continue;
        if (getMinutes(local) >= 30) continue; // only 12:00–12:29 window

        const cycles = await this.promotionRepo.findActiveCyclesForSchool(school.id);
        for (const cycle of cycles) {
          await this.executeReset(cycle, school.id);
        }
      } catch (err) {
        this.logger.error(`Reset job failed for school ${school.id}: ${(err as Error).message}`);
      }
    }
  }

  private async executeReset(
    cycle: { id: string; weekStart: string; weekEnd: string },
    schoolId: string,
  ): Promise<void> {
    const pendingSps = await this.promotionRepo.findPendingSlotPromotionsForCycle(cycle.id);
    let hadResets = false;

    for (const sp of pendingSps) {
      // Mark as reset immediately — this is the source of truth for reconciliation.
      await this.promotionRepo.updateSlotPromotionStatus(sp.id, 'reset', null, new Date());

      // Cancel future sessions BEFORE deleting the slot (sessions reference slot by FK).
      try {
        await this.sessionsPublicService.cancelFutureSessionsFromDate(
          sp.timetableSlotId, cycle.weekStart, schoolId,
        );
      } catch (err) {
        this.logger.error(
          `Failed to cancel sessions for slot ${sp.timetableSlotId}: ${(err as Error).message}`,
        );
      }

      // Delete the slot record AFTER sessions are cancelled.
      try {
        await this.timetablePublicService.deleteSlotRecord(schoolId, sp.timetableSlotId);
      } catch (err) {
        this.logger.error(
          `Failed to delete slot ${sp.timetableSlotId}: ${(err as Error).message}`,
        );
      }

      hadResets = true;
    }

    const newStatus = hadResets ? 'expired' : 'completed';
    await this.promotionRepo.updateCycleStatus(cycle.id, newStatus);
  }

  // Runs daily at 03:00 UTC. Finds reset slot promotions where the slot still exists
  // or sessions are still pending_confirmation, and retries the cleanup.
  @Cron('0 3 * * *')
  async reconcileOrphanedResets(): Promise<void> {
    const orphans = await this.promotionReadRepo.findOrphanedResets();
    if (orphans.length === 0) return;

    this.logger.log(`Reconciling ${orphans.length} orphaned reset(s)`);

    for (const orphan of orphans) {
      if (orphan.hasPendingConfirmationSessions) {
        try {
          await this.sessionsPublicService.cancelFutureSessionsFromDate(
            orphan.timetableSlotId, orphan.weekStart, orphan.schoolId,
          );
        } catch (err) {
          // If slot FK was nulled, fall back to range-based cancellation.
          try {
            await this.sessionsPublicService.cancelOrphanedPendingConfirmationSessions(
              orphan.schoolId, orphan.weekStart, orphan.weekEnd,
            );
          } catch (innerErr) {
            this.logger.error(
              `Session reconciliation failed for slot ${orphan.timetableSlotId}: ${(innerErr as Error).message}`,
            );
          }
        }
      }

      if (orphan.slotStillExists) {
        try {
          await this.timetablePublicService.deleteSlotRecord(orphan.schoolId, orphan.timetableSlotId);
        } catch (err) {
          this.logger.error(
            `Slot reconciliation failed for slot ${orphan.timetableSlotId}: ${(err as Error).message}`,
          );
        }
      }
    }
  }
}
