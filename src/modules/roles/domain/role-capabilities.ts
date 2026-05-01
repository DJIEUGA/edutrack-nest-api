import { UserRole } from '@common/types/role.types';

/**
 * Capability map. Each role lists the action verbs it can perform server-side.
 * Controllers reference these via the @Roles() decorator at the route level;
 * service-layer code can also call hasCapability() for finer checks.
 */
export const ROLE_CAPABILITIES: Record<UserRole, ReadonlySet<string>> = {
  owner: new Set([
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
  ]),
  admin: new Set([
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
  ]),
  director: new Set([
    'school:read',
    'academic:read',
    'timetable:read',
    'session:read',
    'attendance:read',
    'audit:read',
  ]),
  hod: new Set([
    'school:read',
    'academic:read',
    'timetable:read',
    'timetable:write',
    'session:read',
    'session:write',
    'attendance:read',
  ]),
  lecturer: new Set([
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
  ]),
  student: new Set([
    'school:read',
    'academic:read',
    'timetable:read-own',
    'session:read-own',
    'attendance:read-own',
  ]),
  guardian: new Set(['attendance:read-ward', 'session:read-ward']),
  follower: new Set(['organization:read']),
};

export function hasCapability(role: UserRole, capability: string): boolean {
  const caps = ROLE_CAPABILITIES[role];
  if (!caps) return false;
  
  // Check for exact match or wildcard match
  if (caps.has(capability)) return true;
  const [domain] = capability.split(':');
  return caps.has(`${domain}:*`);
}
