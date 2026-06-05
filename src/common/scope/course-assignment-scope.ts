import { UserRole } from '@common/types/role.types';

const PRIVILEGED: readonly UserRole[] = ['admin', 'owner'];
const DEPARTMENT_SCOPED: readonly UserRole[] = ['hod', 'director'];

/**
 * Builds a SQL WHERE fragment (starting with AND) that restricts rows to those
 * the actor is permitted to see, pivoting through a course_assignments alias.
 *
 * @param roles     Resolved roles for the actor in this school
 * @param userId    Actor's user ID
 * @param schoolId  School context
 * @param nextParam Index of the next available $N parameter in the calling query
 * @param caAlias   Alias used for course_assignments in the calling query (default 'ca')
 */
export function buildCourseAssignmentScope(
  roles: UserRole[],
  userId: string,
  schoolId: string,
  nextParam: number,
  caAlias = 'ca',
): { sql: string; params: unknown[] } {
  if (roles.some((r) => PRIVILEGED.includes(r))) {
    return { sql: '', params: [] };
  }

  // HOD and director: courses in their department(s)
  if (roles.some((r) => DEPARTMENT_SCOPED.includes(r))) {
    const p = nextParam;
    return {
      sql: `AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN courses c2 ON c2.department_id = ur.department_id
        WHERE ur.user_id = $${p}
          AND ur.role IN ('hod', 'director')
          AND ur.school_id = $${p + 1}
          AND c2.id = ${caAlias}.course_id
      )`,
      params: [userId, schoolId],
    };
  }

  if (roles.includes('lecturer')) {
    return {
      sql: `AND ${caAlias}.lecturer_user_id = $${nextParam}`,
      params: [userId],
    };
  }

  if (roles.includes('student')) {
    const p = nextParam;
    return {
      sql: `AND EXISTS (
        SELECT 1 FROM students st
        WHERE st.user_id = $${p}
          AND st.school_id = $${p + 1}
          AND st.class_id = ${caAlias}.class_id
      )`,
      params: [userId, schoolId],
    };
  }

  if (roles.includes('guardian')) {
    const p = nextParam;
    return {
      sql: `AND EXISTS (
        SELECT 1 FROM guardian_students gs
        JOIN students st ON st.id = gs.student_id
        WHERE gs.guardian_user_id = $${p}
          AND st.school_id = $${p + 1}
          AND st.class_id = ${caAlias}.class_id
      )`,
      params: [userId, schoolId],
    };
  }

  // No matching role → deny all
  return { sql: 'AND FALSE', params: [] };
}
