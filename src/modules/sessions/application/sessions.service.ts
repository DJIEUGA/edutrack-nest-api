import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenError, NotFoundError, ValidationError } from '@common/errors/domain.errors';
import { UserRole } from '@common/types/role.types';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { buildCourseAssignmentScope } from '@common/scope/course-assignment-scope';

class GeoUtils {
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

const DEFAULT_GEOFENCE_RADIUS_METERS = 100;

const PRIVILEGED_ROLES: UserRole[] = ['admin', 'owner'];

@Injectable()
export class SessionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly roleResolver: RoleResolverService,
  ) {}

  // Throws 403 if the actor (lecturer) is not assigned to the session's course.
  // Admins and owners pass through unconditionally.
  private async assertSessionAccess(
    sessionId: string,
    schoolId: string,
    actorId: string,
    roles: UserRole[],
  ): Promise<void> {
    if (roles.some((r) => PRIVILEGED_ROLES.includes(r))) return;

    if (roles.includes('lecturer')) {
      const [ok] = await this.dataSource.query(
        `SELECT 1 FROM sessions s
         JOIN course_assignments ca ON ca.id = s.course_assignment_id
         WHERE s.id = $1 AND s.school_id = $2 AND ca.lecturer_user_id = $3`,
        [sessionId, schoolId, actorId],
      );
      if (!ok) throw new ForbiddenError('You do not have access to this session');
      return;
    }

    throw new ForbiddenError('You do not have access to this session');
  }

  async list(schoolId: string, actorId: string) {
    const roles = await this.roleResolver.listRolesForUser(actorId, schoolId);
    const scope = buildCourseAssignmentScope(roles, actorId, schoolId, 2);
    return this.dataSource.query(
      `SELECT s.id, s.status, s.scheduled_date as "scheduledDate",
              c.code as "courseCode", c.title as "courseTitle",
              cl.name as "className", p.full_name as "lecturerName"
       FROM sessions s
       JOIN course_assignments ca ON s.course_assignment_id = ca.id
       JOIN courses c ON ca.course_id = c.id
       JOIN classes cl ON ca.class_id = cl.id
       JOIN profiles p ON ca.lecturer_user_id = p.id
       WHERE s.school_id = $1 ${scope.sql}
       ORDER BY s.scheduled_date DESC, s.created_at DESC`,
      [schoolId, ...scope.params],
    );
  }

  async create(schoolId: string, dto: { courseAssignmentId: string; timetableSlotId?: string; scheduledDate: string }) {
    const [session] = await this.dataSource.query(
      `INSERT INTO sessions (school_id, course_assignment_id, timetable_slot_id, scheduled_date, status)
       VALUES ($1, $2, $3, $4, 'scheduled')
       RETURNING id, status, scheduled_date as "scheduledDate"`,
      [schoolId, dto.courseAssignmentId, dto.timetableSlotId || null, dto.scheduledDate],
    );
    return session;
  }

  async startSession(
    sessionId: string,
    schoolId: string,
    actorId: string,
    geo?: { lat: number; lng: number; accuracy: number },
  ) {
    const roles = await this.roleResolver.listRolesForUser(actorId, schoolId);
    await this.assertSessionAccess(sessionId, schoolId, actorId, roles);

    let distance: number | undefined;
    const [sessionContext] = await this.dataSource.query(
      `SELECT s.status, ts.venue,
              v.latitude as "targetLat", v.longitude as "targetLng"
       FROM sessions s
       LEFT JOIN timetable_slots ts ON s.timetable_slot_id = ts.id
       LEFT JOIN venues v ON ts.venue = v.id::text
       WHERE s.id = $1 AND s.school_id = $2`,
      [sessionId, schoolId],
    );

    if (!sessionContext) throw new NotFoundError('Session not found');
    if (sessionContext.status !== 'scheduled') {
      throw new ValidationError('Only scheduled sessions can be started');
    }

    if (sessionContext.targetLat && sessionContext.targetLng && geo?.lat && geo?.lng) {
      distance = GeoUtils.calculateDistance(
        geo.lat,
        geo.lng,
        parseFloat(sessionContext.targetLat),
        parseFloat(sessionContext.targetLng),
      );

      if (distance > DEFAULT_GEOFENCE_RADIUS_METERS) {
        throw new ValidationError(
          `You are too far from the venue (${sessionContext.venue}). Current distance: ${Math.round(distance)}m.`,
          {
            code: 'GEOFENCE_VIOLATION',
            distanceMeters: Math.round(distance),
            threshold: DEFAULT_GEOFENCE_RADIUS_METERS,
          },
        );
      }
    }

    const [session] = await this.dataSource.query(
      `UPDATE sessions
       SET status = 'live', actual_start = NOW(), started_by = $1,
           start_lat = $2, start_lng = $3, start_accuracy = $4
       WHERE id = $5 AND school_id = $6 AND status = 'scheduled'
       RETURNING id, status, actual_start as "startedAt"`,
      [actorId, geo?.lat || null, geo?.lng || null, geo?.accuracy || null, sessionId, schoolId],
    );

    if (!session) {
      throw new ValidationError('Session failed to start. It may have already been started or cancelled.');
    }

    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        schoolId,
        'session:start',
        'session',
        sessionId,
        JSON.stringify({
          location: geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy } : null,
          distanceMeters: typeof distance === 'number' ? Math.round(distance) : null,
          venue: sessionContext.venue,
        }),
      ],
    );

    return session;
  }

  async endSession(sessionId: string, schoolId: string, actorId: string) {
    const roles = await this.roleResolver.listRolesForUser(actorId, schoolId);
    await this.assertSessionAccess(sessionId, schoolId, actorId, roles);

    const [session] = await this.dataSource.query(
      `UPDATE sessions
       SET status = 'completed', actual_end = NOW(), ended_by = $1
       WHERE id = $2 AND school_id = $3 AND status = 'live'
       RETURNING id, status, actual_end as "endedAt"`,
      [actorId, sessionId, schoolId],
    );
    if (!session) throw new NotFoundError('Session is not live');
    return session;
  }

  async cancelSession(sessionId: string, schoolId: string, actorId: string, reason: string) {
    const roles = await this.roleResolver.listRolesForUser(actorId, schoolId);
    await this.assertSessionAccess(sessionId, schoolId, actorId, roles);

    const [existing] = await this.dataSource.query(
      `SELECT id, status FROM sessions WHERE id = $1 AND school_id = $2`,
      [sessionId, schoolId],
    );

    if (!existing) throw new NotFoundError('Session not found');

    if (existing.status === 'live') {
      throw new ValidationError('Session is currently live. End it first before cancelling.');
    }
    if (existing.status === 'completed') {
      throw new ValidationError('Completed sessions cannot be cancelled.');
    }
    if (existing.status === 'cancelled') {
      throw new ValidationError('Session is already cancelled.');
    }

    await this.dataSource.query(
      `DELETE FROM attendance_records WHERE session_id = $1`,
      [sessionId],
    );

    const [cancelled] = await this.dataSource.query(
      `UPDATE sessions
       SET status = 'cancelled', cancellation_reason = $1, cancelled_by = $2, updated_at = NOW()
       WHERE id = $3 AND school_id = $4 AND status = 'scheduled'
       RETURNING id, status, cancellation_reason as "cancellationReason"`,
      [reason, actorId, sessionId, schoolId],
    );

    if (!cancelled) throw new ValidationError('Session could not be cancelled.');

    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, schoolId, 'session:cancel', 'session', sessionId, JSON.stringify({ reason })],
    );

    return cancelled;
  }
}
