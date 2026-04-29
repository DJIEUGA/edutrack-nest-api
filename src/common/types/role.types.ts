export type UserRole =
  | 'owner'
  | 'admin'
  | 'director'
  | 'hod'
  | 'lecturer'
  | 'student'
  | 'guardian'
  | 'follower';

export const USER_ROLES: readonly UserRole[] = [
  'owner',
  'admin',
  'director',
  'hod',
  'lecturer',
  'student',
  'guardian',
  'follower',
] as const;
