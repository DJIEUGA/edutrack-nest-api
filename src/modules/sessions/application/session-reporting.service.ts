import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class SessionReportingService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private readonly defaultGeofenceRadiusMeters = 100;

  /**
   * Retrieves a report of sessions that are non-compliant with geo-fencing policies.
   * This includes sessions started too far from the venue or without any location data.
   */
  async getEnrollmentReport(schoolId: string, academicYearId?: string) {
    const [totals] = await this.dataSource.query(
      `SELECT
         COUNT(*)::int as "totalStudents",
         COUNT(CASE WHEN status = 'approved'   THEN 1 END)::int as "approved",
         COUNT(CASE WHEN status = 'pending'    THEN 1 END)::int as "pending",
         COUNT(CASE WHEN status = 'rejected'   THEN 1 END)::int as "rejected",
         COUNT(CASE WHEN status = 'waitlisted' THEN 1 END)::int as "waitlisted"
       FROM students WHERE school_id = $1`,
      [schoolId],
    );

    const byDepartment = await this.dataSource.query(
      `SELECT d.id as "departmentId", d.name, COUNT(s.id)::int as count
       FROM students s
       JOIN classes cl ON s.class_id = cl.id
       JOIN programs pr ON cl.program_id = pr.id
       JOIN departments d ON pr.department_id = d.id
       WHERE s.school_id = $1
         AND s.status = 'approved'
         AND ($2::uuid IS NULL OR cl.academic_year_id = $2)
       GROUP BY d.id, d.name
       ORDER BY count DESC`,
      [schoolId, academicYearId || null],
    );

    return { ...totals, byDepartment };
  }

  async getAttendanceTrendReport(schoolId: string, filters: { academicYearId?: string; period?: 'week' | 'month' }) {
    const period = filters.period ?? 'week';
    const truncUnit = period === 'week' ? 'week' : 'month';

    const [rateRow] = await this.dataSource.query(
      `SELECT ROUND(
         AVG(CASE WHEN ar.status IN ('present','late') THEN 100.0 ELSE 0 END), 2
       ) as "averageRate",
       COUNT(DISTINCT CASE
         WHEN (
           SELECT ROUND(COUNT(CASE WHEN ar2.status IN ('present','late') THEN 1 END)::numeric
                  / NULLIF(COUNT(ar2.id), 0) * 100, 2)
           FROM attendance_records ar2
           WHERE ar2.student_id = ar.student_id AND ar2.school_id = $1
         ) < 75 THEN ar.student_id
       END)::int as "atRiskCount"
       FROM attendance_records ar
       WHERE ar.school_id = $1`,
      [schoolId],
    );

    const byPeriod = await this.dataSource.query(
      `SELECT
         DATE_TRUNC($2, sess.actual_start)::date as "periodStart",
         TO_CHAR(DATE_TRUNC($2, sess.actual_start), 'Mon DD') as label,
         ROUND(AVG(CASE WHEN ar.status IN ('present','late') THEN 100.0 ELSE 0 END), 2) as rate
       FROM attendance_records ar
       JOIN sessions sess ON ar.session_id = sess.id
       WHERE ar.school_id = $1
         AND ($3::uuid IS NULL OR sess.academic_year_id = $3)
         AND sess.actual_start IS NOT NULL
       GROUP BY DATE_TRUNC($2, sess.actual_start)
       ORDER BY "periodStart" ASC`,
      [schoolId, truncUnit, filters.academicYearId || null],
    );

    return {
      averageRate: rateRow?.averageRate ?? null,
      atRiskCount: rateRow?.atRiskCount ?? 0,
      byPeriod,
    };
  }

  async getGeoComplianceReport(schoolId: string, limit: number = 100, offset: number = 0) {
    return this.dataSource.query(
      `SELECT 
         s.id as "sessionId",
         s.scheduled_date as "scheduledDate",
         s.actual_start as "startedAt",
         c.code as "courseCode",
         c.title as "courseTitle",
         p.full_name as "lecturerName",
         ts.venue as "venueName",
         s.start_lat as "lecturerLat",
         s.start_lng as "lecturerLng",
         (al.metadata->>'distanceMeters')::numeric as "distanceMeters",
         CASE 
           WHEN s.start_lat IS NULL OR s.start_lng IS NULL THEN 'MISSING_LOCATION'
           WHEN (al.metadata->>'distanceMeters')::numeric > $2 THEN 'GEOFENCE_VIOLATION'
           ELSE 'COMPLIANT'
         END as "violationType"
       FROM sessions s
       JOIN course_assignments ca ON s.course_assignment_id = ca.id
       JOIN courses c ON ca.course_id = c.id
       JOIN profiles p ON ca.lecturer_user_id = p.id
       LEFT JOIN timetable_slots ts ON s.timetable_slot_id = ts.id
       LEFT JOIN audit_logs al ON al.resource_id = s.id AND al.action = 'session:start'
       WHERE s.school_id = $1
         AND (
           s.start_lat IS NULL 
           OR (al.metadata->>'distanceMeters')::numeric > $2::numeric
         )
       ORDER BY s.scheduled_date DESC, s.actual_start DESC
       LIMIT $3 OFFSET $4`,
      [schoolId, this.defaultGeofenceRadiusMeters, limit, offset],
    );
  }
}