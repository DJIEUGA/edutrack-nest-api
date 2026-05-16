import { UserRole } from '@common/types/role.types';

/**
 * Capability map. Each role lists:
 *   - Fine-grained backend codes (domain:action) used with hasCapability() guards
 *   - Frontend navigation codes (verb:resource) from the requirements spec, merged
 *     into the permissions array returned to the client via listUserRolesBySchool.
 */
export const ROLE_CAPABILITIES: Record<UserRole, ReadonlySet<string>> = {
  owner: new Set([
    // Backend authorization
    'organization:*',
    'school:*',
    'user-role:assign',
    'user-role:revoke',
    'academic:*',
    'timetable:*',
    'session:*',
    'attendance:*',
    'invitation:*',
    'import:*',
    'audit:read',
    // Frontend navigation — role capability set
    'manage:organization',
    'manage:schools',
    'manage:users',
    'manage:billing',
    'view:analytics',
    'view:all-data',
    // Frontend navigation — workspace items (owner sees everything)
    'manage:school',
    'manage:departments',
    'manage:staff',
    'manage:timetables',
    'manage:rooms',
    'view:school-analytics',
    'view:all-school-data',
    'manage:schedules',
    'manage:student-records',
    'view:reports',
    'manage:announcements',
    'manage:department',
    'manage:courses',
    'manage:lecturers',
    'approve:timetables',
    'view:department-analytics',
    'manage:sessions',
    'start:session',
    'end:session',
    'mark:attendance',
    'view:class-roster',
    'manage:course-materials',
    'view:timetable',
    'view:attendance',
    'view:grades',
    'view:course-materials',
    'view:linked-students',
    'view:student-attendance',
    'view:student-grades',
    'view:public-info',
    'view:announcements',
    // Gap permissions resolved
    'manage:imports',
    'view:student-records',
    // Class management
    'manage:classes',
    'view:classmates',
    'manage:enrollments',
  ]),

  admin: new Set([
    // Backend authorization
    'school:read',
    'school:update',
    'user-role:assign',
    'user-role:revoke',
    'academic:*',
    'timetable:*',
    'session:*',
    'session:override-conflict',
    'attendance:*',
    'invitation:*',
    'import:*',
    'audit:read',
    // Frontend navigation — role capability set
    'manage:timetables',
    'manage:rooms',
    'manage:schedules',
    'manage:student-records',
    'view:reports',
    'manage:announcements',
    // Frontend navigation — workspace extras for admin
    'manage:school',
    'manage:departments',
    'manage:staff',
    'view:school-analytics',
    // Gap permissions resolved
    'manage:courses',
    'manage:imports',
    'view:student-records',
    'view:student-grades',
    // Class management
    'manage:classes',
    'view:classmates',
    'manage:enrollments',
  ]),

  director: new Set([
    // Backend authorization
    'school:read',
    'academic:read',
    'timetable:read',
    'session:read',
    'attendance:read',
    'audit:read',
    // Frontend navigation — role capability set
    'manage:school',
    'manage:departments',
    'manage:staff',
    'manage:timetables',
    'manage:rooms',
    'view:school-analytics',
    'view:all-school-data',
    // Gap permissions resolved
    'manage:courses',
    'view:student-records',
    'view:student-grades',
    'view:reports',
    // Class management
    'manage:classes',
    'view:classmates',
    'manage:enrollments',
  ]),

  hod: new Set([
    // Backend authorization
    'school:read',
    'academic:read',
    'timetable:read',
    'timetable:write',
    'session:read',
    'session:write',
    'attendance:read',
    // Frontend navigation — role capability set
    'manage:department',
    'manage:courses',
    'manage:lecturers',
    'approve:timetables',
    'view:department-analytics',
    // Gap permissions resolved
    'view:student-grades',
    // Class management
    'manage:classes',
    'view:classmates',
  ]),

  lecturer: new Set([
    // Backend authorization
    'school:read',
    'academic:read',
    'timetable:read',
    'session:read',
    'session:write-own',
    'session:start',
    'session:end',
    'session:reschedule-own',
    'attendance:read',
    'attendance:mark',
    // Frontend navigation — role capability set
    'manage:sessions',
    'start:session',
    'end:session',
    'mark:attendance',
    'view:class-roster',
    'manage:course-materials',
    'view:classmates',
  ]),

  student: new Set([
    // Backend authorization
    'school:read',
    'academic:read',
    'timetable:read-own',
    'session:read-own',
    'attendance:read-own',
    // Frontend navigation — role capability set
    'view:timetable',
    'view:attendance',
    'view:grades',
    'view:course-materials',
    'join:session',
    'view:classmates',
  ]),

  guardian: new Set([
    // Backend authorization
    'attendance:read-ward',
    'session:read-ward',
    // Frontend navigation — role capability set
    'view:linked-students',
    'view:student-attendance',
    'view:student-grades',
    'receive:notifications',
  ]),

  follower: new Set([
    // Backend authorization
    'organization:read',
    // Frontend navigation — role capability set
    'view:public-info',
    'view:announcements',
  ]),
};

export function hasCapability(role: UserRole, capability: string): boolean {
  const caps = ROLE_CAPABILITIES[role];
  if (!caps) return false;

  if (caps.has(capability)) return true;
  const [domain] = capability.split(':');
  return caps.has(`${domain}:*`);
}
