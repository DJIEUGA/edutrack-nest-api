import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@common/errors/domain.errors';
import { ScheduleConfigRepository } from '@modules/schools/infrastructure/schedule-config.repository';
import { ClassTimetableRepository, ClassSlotRow } from '../infrastructure/class-timetable.repository';
import { TimetableService } from './timetable.service';

export interface GridBlock {
  startTime: string;
  endTime: string;
  status: 'occupied' | 'free';
  slot?: {
    id: string;
    courseAssignmentId: string;
    courseCode: string;
    courseTitle: string;
    venue: string | null;
    lecturer: {
      userId: string;
      name: string | null;
      email: string | null;
      phone: string | null;
    };
  };
}

@Injectable()
export class ClassTimetableService {
  constructor(
    private readonly classRepo: ClassTimetableRepository,
    private readonly scheduleConfigRepo: ScheduleConfigRepository,
    private readonly timetableService: TimetableService,
  ) {}

  async getSharedTimetable(
    schoolId: string,
    classId: string,
    actorId: string,
    roles: string[],
    academicYearId?: string,
  ) {
    const cls = await this.classRepo.findClassWithDelegate(schoolId, classId);
    if (!cls) throw new NotFoundError('Class not found');

    await this.assertReadAccess(schoolId, classId, actorId, roles);

    const [days, timeBlocks, slots] = await Promise.all([
      this.scheduleConfigRepo.getScheduleDays(schoolId),
      this.scheduleConfigRepo.getTimeBlocks(schoolId),
      this.classRepo.findSlotsForClass(schoolId, classId, academicYearId),
    ]);

    const slotIndex = buildSlotIndex(slots);

    const grid = days.map((dayOfWeek) => ({
      dayOfWeek,
      blocks: timeBlocks.map((block): GridBlock => {
        const key = `${dayOfWeek}|${block.startTime}|${block.endTime}`;
        const slot = slotIndex.get(key);
        if (slot) {
          return {
            startTime: block.startTime,
            endTime: block.endTime,
            status: 'occupied',
            slot: {
              id: slot.id,
              courseAssignmentId: slot.courseAssignmentId,
              courseCode: slot.courseCode,
              courseTitle: slot.courseTitle,
              venue: slot.venue,
              lecturer: {
                userId: slot.lecturerUserId,
                name: slot.lecturerName,
                email: slot.lecturerEmail,
                phone: slot.lecturerPhone,
              },
            },
          };
        }
        return { startTime: block.startTime, endTime: block.endTime, status: 'free' };
      }),
    }));

    return {
      class: {
        id: cls.id,
        name: cls.name,
        delegate: cls.delegateStudentId
          ? { name: cls.delegateName, email: cls.delegateEmail, phone: cls.delegatePhone }
          : null,
      },
      config: { days, timeBlocks },
      grid,
    };
  }

  async createSlot(
    schoolId: string,
    classId: string,
    actorId: string,
    roles: string[],
    dto: {
      academicYearId: string;
      courseAssignmentId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      venue?: string;
    },
  ) {
    if (roles.includes('lecturer')) {
      const ca = await this.classRepo.getCourseAssignment(dto.courseAssignmentId, schoolId);
      if (!ca) throw new NotFoundError('Course assignment not found');
      if (ca.classId !== classId) {
        throw new ForbiddenError('This course assignment does not belong to the specified class');
      }
    }
    return this.timetableService.create(schoolId, actorId, roles, dto);
  }

  async updateSlot(
    schoolId: string,
    classId: string,
    slotId: string,
    actorId: string,
    roles: string[],
    dto: { dayOfWeek?: number; startTime?: string; endTime?: string; venue?: string },
  ) {
    if (roles.includes('lecturer')) {
      await this.assertSlotBelongsToClass(slotId, schoolId, classId);
    }
    return this.timetableService.update(schoolId, slotId, actorId, roles, dto);
  }

  async deleteSlot(
    schoolId: string,
    classId: string,
    slotId: string,
    actorId: string,
    roles: string[],
  ) {
    if (roles.includes('lecturer')) {
      await this.assertSlotBelongsToClass(slotId, schoolId, classId);
    }
    return this.timetableService.remove(schoolId, slotId, actorId, roles);
  }

  private async assertReadAccess(
    schoolId: string,
    classId: string,
    actorId: string,
    roles: string[],
  ): Promise<void> {
    if (roles.includes('owner') || roles.includes('admin')) return;

    if (roles.includes('hod') || roles.includes('director')) {
      const ok = await this.classRepo.verifyHodOverClass(schoolId, classId, actorId);
      if (ok) return;
    }

    if (roles.includes('lecturer')) {
      const ok = await this.classRepo.verifyLecturerInClass(schoolId, classId, actorId);
      if (ok) return;
    }

    if (roles.includes('student')) {
      const ok = await this.classRepo.verifyStudentInClass(schoolId, classId, actorId);
      if (ok) return;
    }

    throw new ForbiddenError('You do not have access to this class timetable');
  }

  private async assertSlotBelongsToClass(slotId: string, schoolId: string, classId: string): Promise<void> {
    const belongs = await this.classRepo.slotBelongsToClass(slotId, schoolId, classId);
    if (!belongs) throw new ForbiddenError('This timetable slot does not belong to the specified class');
  }
}

function buildSlotIndex(slots: ClassSlotRow[]): Map<string, ClassSlotRow> {
  const map = new Map<string, ClassSlotRow>();
  for (const slot of slots) {
    map.set(`${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`, slot);
  }
  return map;
}
