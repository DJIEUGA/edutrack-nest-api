import { UserRole } from '@common/types/role.types';

/**
 * Roles considered "staff" (excludes students, guardians, followers).
 * Used for dedicated staff roster endpoints.
 */
export const STAFF_ROLES: readonly UserRole[] = ['admin', 'director', 'hod', 'lecturer'] as const;

/**
 * Defines which roles a given actor role is authorised to invite, assign,
 * revoke, or remove. An actor must hold at least one role that lists the
 * target role here.
 *
 * Read as: "an actor with role X can manage users who hold role Y".
 */
export const MANAGEMENT_HIERARCHY: Record<UserRole, ReadonlyArray<UserRole>> = {
  owner:    ['admin', 'director', 'hod', 'lecturer'],
  admin:    ['director', 'hod', 'lecturer', 'student'],
  director: ['hod', 'lecturer'],
  hod:      ['lecturer', 'student'],
  lecturer: [],
  student:  [],
  guardian: [],
  follower: [],
};

/**
 * Returns true when any of the actor's current roles grants them authority
 * over the given target role.
 */
export function canManageRole(actorRoles: UserRole[], targetRole: UserRole): boolean {
  return actorRoles.some((r) => (MANAGEMENT_HIERARCHY[r] ?? []).includes(targetRole));
}

/**
 * Returns the union of all roles an actor (with any of the supplied roles)
 * is allowed to manage.
 */
export function getManageableRoles(actorRoles: UserRole[]): UserRole[] {
  const result = new Set<UserRole>();
  for (const r of actorRoles) {
    for (const managed of MANAGEMENT_HIERARCHY[r] ?? []) {
      result.add(managed);
    }
  }
  return Array.from(result);
}

/**
 * Returns roles in the hierarchy that are considered "above" a given role —
 * useful for deciding who can manage whom when the actor's full role list is
 * not yet available.
 */
export function rolesAbove(targetRole: UserRole): UserRole[] {
  return (Object.entries(MANAGEMENT_HIERARCHY) as [UserRole, ReadonlyArray<UserRole>][])
    .filter(([, managed]) => managed.includes(targetRole))
    .map(([role]) => role);
}
