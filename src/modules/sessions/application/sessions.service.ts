import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundError, ValidationError } from '@common/errors/domain.errors';
// Local GeoUtils replacement to avoid dependency on external module
class GeoUtils {
  // Haversine formula to calculate distance in meters between two lat/lng points
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
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

@Injectable()
export class SessionsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(schoolId: string, dto: { courseAssignmentId: string; timetableSlotId?: string; scheduledDate: string }) {
    const [session] = await this.dataSource.query(
      `INSERT INTO sessions (school_id, course_assignment_id, timetable_slot_id, scheduled_date, status)
       VALUES ($1, $2, $3, $4, 'scheduled')
       RETURNING id, status, scheduled_date as "scheduledDate"`,
      [schoolId, dto.courseAssignmentId, dto.timetableSlotId || null, dto.scheduledDate],
    );
    return session;
  }

  async startSession(sessionId: string, schoolId: string, actorId: string, geo?: { lat: number; lng: number; accuracy: number }) {
    let distance: number | undefined;
    // 1. Fetch session and venue coordinates for validation
    const [sessionContext] = await this.dataSource.query(
      `SELECT s.status, ts.venue, 
              v.latitude as "targetLat", v.longitude as "targetLng"
       FROM sessions s
       LEFT JOIN timetable_slots ts ON s.timetable_slot_id = ts.id
       LEFT JOIN venues v ON ts.venue = v.name
       WHERE s.id = $1 AND s.school_id = $2`,
      [sessionId, schoolId],
    );

    if (!sessionContext) throw new NotFoundError('Session not found');
    if (sessionContext.status !== 'scheduled') {
      throw new ValidationError('Only scheduled sessions can be started');
    }

    // 2. Geo-fence Validation Utility Logic
    // If target coordinates exist and lecturer provided their location, enforce the radius
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
            threshold: DEFAULT_GEOFENCE_RADIUS_METERS 
          }
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
      // This handles cases where the status changed between the SELECT check and the UPDATE
      throw new ValidationError('Session failed to start. It may have already been started, cancelled, or the ID is invalid.');
    }

    // 3. Audit Logging (Recorded distance and lecturer location)
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

  async list(schoolId: string) {
    return this.dataSource.query(
      `SELECT s.id, s.status, s.scheduled_date as "scheduledDate",
              c.code as "courseCode", c.title as "courseTitle",
              cl.name as "className", p.full_name as "lecturerName"
       FROM sessions s
       JOIN course_assignments ca ON s.course_assignment_id = ca.id
       JOIN courses c ON ca.course_id = c.id
       JOIN classes cl ON ca.class_id = cl.id
       JOIN profiles p ON ca.lecturer_user_id = p.id
       WHERE s.school_id = $1
       ORDER BY s.scheduled_date DESC, s.created_at DESC`,
      [schoolId],
    );
  }
}