import { Injectable } from '@nestjs/common';
import { addDays, format, getDay, nextMonday, isMonday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@common/errors/domain.errors';
import { SessionsPublicService } from '@modules/sessions/application/sessions-public.service';
import { TimetablePublicService, UpdateSlotFieldsDto } from '@modules/timetable/application/timetable-public.service';
import { PromotionRepository } from '../infrastructure/promotion.repository';
import { PromotionReadRepository } from '../infrastructure/promotion-read.repository';

@Injectable()
export class PromotionService {
  constructor(
    private readonly promotionRepo: PromotionRepository,
    private readonly promotionReadRepo: PromotionReadRepository,
    private readonly sessionsPublicService: SessionsPublicService,
    private readonly timetablePublicService: TimetablePublicService,
  ) {}

  // Computes the Monday of the next Mon–Sun week in the school's local timezone.
  private computeNextMonday(timezone: string): string {
    const nowInSchool = toZonedTime(new Date(), timezone);
    const base = isMonday(nowInSchool) ? addDays(nowInSchool, 7) : nextMonday(nowInSchool);
    return format(base, 'yyyy-MM-dd');
  }

  private computeWeekEnd(weekStart: string): string {
    const monday = new Date(`${weekStart}T00:00:00`);
    return format(addDays(monday, 6), 'yyyy-MM-dd');
  }

  async triggerPromotion(schoolId: string, actorId: string, weekStart?: string) {
    const school = await this.promotionReadRepo.findSchoolTimezone(schoolId);
    if (!school) throw new NotFoundError('School not found');

    const resolvedWeekStart = weekStart ?? this.computeNextMonday(school.timezone);
    const resolvedWeekEnd = this.computeWeekEnd(resolvedWeekStart);

    const activeYear = await this.promotionReadRepo.findActiveAcademicYear(schoolId);
    if (!activeYear) throw new ValidationError('No active academic year found for this school');
    if (resolvedWeekStart < activeYear.startDate || resolvedWeekStart > activeYear.endDate) {
      throw new ValidationError('The promoted week falls outside the active academic year');
    }

    const existing = await this.promotionRepo.findCycleBySchoolAndWeek(schoolId, resolvedWeekStart);
    if (existing) {
      if (existing.status === 'active') return existing;
      throw new ConflictError('A promotion cycle for this week already exists and has closed');
    }

    const cycle = await this.promotionRepo.createCycle({
      schoolId,
      weekStart: resolvedWeekStart,
      weekEnd: resolvedWeekEnd,
      triggeredBy: actorId,
      triggeredAt: new Date(),
    });

    const slots = await this.promotionReadRepo.findActiveSlotsForSchool(schoolId, activeYear.id);

    const eligibleSlots: { id: string; lecturerUserId: string }[] = [];
    for (const slot of slots) {
      const hasSession = await this.promotionReadRepo.slotHasSessionsInWeek(
        slot.id, resolvedWeekStart, resolvedWeekEnd,
      );
      if (hasSession) eligibleSlots.push({ id: slot.id, lecturerUserId: slot.lecturerUserId });
    }

    if (eligibleSlots.length === 0) return cycle;

    await this.promotionRepo.createSlotPromotions(
      eligibleSlots.map((s) => ({
        promotionCycleId: cycle.id,
        timetableSlotId: s.id,
        lecturerUserId: s.lecturerUserId,
        schoolId,
      })),
    );

    await this.sessionsPublicService.transitionToPendingConfirmation(
      eligibleSlots.map((s) => s.id),
      resolvedWeekStart,
      resolvedWeekEnd,
      schoolId,
    );

    const uniqueLecturers = [...new Set(eligibleSlots.map((s) => s.lecturerUserId))];
    await this.promotionRepo.createReminders(
      uniqueLecturers.map((lecturerId) => ({
        promotionCycleId: cycle.id,
        lecturerUserId: lecturerId,
        schoolId,
        message: `Timetable confirmation required for week ${resolvedWeekStart} to ${resolvedWeekEnd}. Deadline: Sunday noon.`,
        sentAt: new Date(),
      })),
    );

    return cycle;
  }

  async listCycles(schoolId: string) {
    return this.promotionRepo.listCyclesForSchool(schoolId);
  }

  async getCycleDetail(schoolId: string, cycleId: string) {
    const cycle = await this.promotionRepo.findCycleById(cycleId);
    if (!cycle || cycle.schoolId !== schoolId) throw new NotFoundError('Promotion cycle not found');
    const slots = await this.promotionRepo.getCycleDetail(cycleId, schoolId);
    return { ...cycle, slots };
  }

  async getMyActiveCycle(schoolId: string, lecturerUserId: string) {
    const [cycle] = await this.promotionRepo.findActiveCyclesForSchool(schoolId);
    if (!cycle) return null;
    const mySlots = await this.promotionRepo.findMySlotPromotionsForCycle(cycle.id, lecturerUserId);
    return { ...cycle, mySlots };
  }

  async confirmSlot(schoolId: string, slotPromotionId: string, actorId: string): Promise<void> {
    const sp = await this.assertSlotPromotionAccess(slotPromotionId, schoolId, actorId);
    if (sp.status !== 'pending') {
      throw new ValidationError(`Slot is already ${sp.status}`);
    }

    await this.promotionRepo.updateSlotPromotionStatus(slotPromotionId, 'confirmed', new Date());

    const cycle = await this.promotionRepo.findCycleById(sp.promotionCycleId);
    await this.sessionsPublicService.transitionToScheduled(
      sp.timetableSlotId, cycle.weekStart, cycle.weekEnd, schoolId,
    );
  }

  async modifySlotLevel(
    schoolId: string,
    slotPromotionId: string,
    actorId: string,
    dto: UpdateSlotFieldsDto,
  ): Promise<void> {
    const sp = await this.assertSlotPromotionAccess(slotPromotionId, schoolId, actorId);
    if (sp.status === 'reset') {
      throw new ValidationError('Cannot modify a reset slot promotion');
    }

    await this.timetablePublicService.updateSlotFields(schoolId, sp.timetableSlotId, dto);
    await this.promotionRepo.updateSlotPromotionStatus(slotPromotionId, 'modified', new Date());

    const cycle = await this.promotionRepo.findCycleById(sp.promotionCycleId);
    await this.sessionsPublicService.transitionToScheduled(
      sp.timetableSlotId, cycle.weekStart, cycle.weekEnd, schoolId,
    );
  }

  async rescheduleSession(
    schoolId: string,
    slotPromotionId: string,
    sessionId: string,
    actorId: string,
    newDate: string,
  ): Promise<void> {
    const sp = await this.assertSlotPromotionAccess(slotPromotionId, schoolId, actorId);
    if (sp.status === 'reset') {
      throw new ValidationError('Cannot modify a reset slot promotion');
    }

    await this.sessionsPublicService.rescheduleSession(sessionId, newDate, schoolId);

    if (sp.status === 'pending') {
      await this.promotionRepo.updateSlotPromotionStatus(slotPromotionId, 'confirmed', new Date());
    }

    const cycle = await this.promotionRepo.findCycleById(sp.promotionCycleId);
    // Transition remaining pending_confirmation sessions for this slot/week to scheduled.
    await this.sessionsPublicService.transitionToScheduled(
      sp.timetableSlotId, cycle.weekStart, cycle.weekEnd, schoolId,
    );
  }

  async cancelWeekSession(
    schoolId: string,
    slotPromotionId: string,
    sessionId: string,
    actorId: string,
  ): Promise<void> {
    const sp = await this.assertSlotPromotionAccess(slotPromotionId, schoolId, actorId);
    if (sp.status === 'reset') {
      throw new ValidationError('Cannot modify a reset slot promotion');
    }

    await this.sessionsPublicService.cancelOneSession(sessionId, schoolId);

    if (sp.status === 'pending') {
      await this.promotionRepo.updateSlotPromotionStatus(slotPromotionId, 'confirmed', new Date());
    }

    const cycle = await this.promotionRepo.findCycleById(sp.promotionCycleId);
    await this.sessionsPublicService.transitionToScheduled(
      sp.timetableSlotId, cycle.weekStart, cycle.weekEnd, schoolId,
    );
  }

  private async assertSlotPromotionAccess(
    slotPromotionId: string,
    schoolId: string,
    actorId: string,
  ) {
    const sp = await this.promotionRepo.findSlotPromotion(slotPromotionId, schoolId);
    if (!sp) throw new NotFoundError('Slot promotion not found');
    if (sp.lecturerUserId !== actorId) throw new ForbiddenError('This slot promotion does not belong to you');

    const cycle = await this.promotionRepo.findCycleById(sp.promotionCycleId);
    if (!cycle || cycle.status !== 'active') {
      throw new ValidationError('The promotion cycle is no longer active');
    }
    return sp;
  }
}
