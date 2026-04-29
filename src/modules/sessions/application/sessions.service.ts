import { ForbiddenException, Injectable } from '@nestjs/common';
import { NotFoundError } from '@common/errors/domain.errors';
import { Session } from '../domain/session.entity';
import { SessionRepository } from '../infrastructure/session.repository';

@Injectable()
export class SessionsService {
  constructor(private readonly sessions: SessionRepository) {}

  list(
    schoolId: string,
    filters: { courseAssignmentId?: string; scheduledDate?: string } = {},
  ): Promise<Session[]> {
    return this.sessions.list(schoolId, filters);
  }

  async getById(schoolId: string, id: string): Promise<Session> {
    const session = await this.sessions.findById(id);
    if (!session || session.schoolId !== schoolId) {
      throw new NotFoundError('Session not found', { id });
    }
    return session;
  }

  create(input: {
    schoolId: string;
    courseAssignmentId: string;
    timetableSlotId?: string | null;
    scheduledDate: string;
  }): Promise<Session> {
    return this.sessions.create(input);
  }

  async start(
    schoolId: string,
    id: string,
    payload: { startedBy: string; lat?: number; lng?: number; accuracy?: number },
  ): Promise<Session> {
    const session = await this.getById(schoolId, id);
    if (session.status !== 'scheduled') {
      throw new ForbiddenException(`Cannot start a session in '${session.status}' state`);
    }
    const updated = await this.sessions.updateStatus(id, 'in_progress', {
      actualStart: new Date(),
      startedBy: payload.startedBy,
      startLat: payload.lat ?? null,
      startLng: payload.lng ?? null,
      startAccuracy: payload.accuracy ?? null,
    });
    return updated!;
  }

  async end(schoolId: string, id: string, endedBy: string): Promise<Session> {
    const session = await this.getById(schoolId, id);
    if (session.status !== 'in_progress') {
      throw new ForbiddenException(`Cannot end a session in '${session.status}' state`);
    }
    const updated = await this.sessions.updateStatus(id, 'completed', {
      actualEnd: new Date(),
      endedBy,
    });
    return updated!;
  }

  async cancel(schoolId: string, id: string): Promise<Session> {
    const session = await this.getById(schoolId, id);
    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new ForbiddenException(`Cannot cancel a session in '${session.status}' state`);
    }
    const updated = await this.sessions.updateStatus(id, 'cancelled');
    return updated!;
  }
}
