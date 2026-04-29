import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from '../domain/session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
  ) {}

  findById(id: string): Promise<Session | null> {
    return this.repo.findOne({ where: { id } });
  }

  list(
    schoolId: string,
    filters: { courseAssignmentId?: string; scheduledDate?: string } = {},
  ): Promise<Session[]> {
    const where: Record<string, unknown> = { schoolId };
    if (filters.courseAssignmentId) where.courseAssignmentId = filters.courseAssignmentId;
    if (filters.scheduledDate) where.scheduledDate = filters.scheduledDate;
    return this.repo.find({ where, order: { scheduledDate: 'ASC', createdAt: 'ASC' } });
  }

  create(input: {
    schoolId: string;
    courseAssignmentId: string;
    timetableSlotId?: string | null;
    scheduledDate: string;
  }): Promise<Session> {
    return this.repo.save(this.repo.create({ ...input, status: 'scheduled' }));
  }

  async updateStatus(
    id: string,
    status: SessionStatus,
    extra?: Partial<
      Pick<
        Session,
        | 'actualStart'
        | 'actualEnd'
        | 'startLat'
        | 'startLng'
        | 'startAccuracy'
        | 'startedBy'
        | 'endedBy'
      >
    >,
  ): Promise<Session | null> {
    await this.repo.update({ id }, { status, ...extra });
    return this.findById(id);
  }
}
