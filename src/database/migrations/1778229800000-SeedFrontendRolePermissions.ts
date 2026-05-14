import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the frontend-facing permission codes (manage:X, view:X, etc.) that
 * the client checks for navigation visibility. These mirror the ROLE_CAPABILITIES
 * map so that DB-level permission checks stay consistent with the static map.
 *
 * Also resolves the gap permissions identified in docs/role-permissions-requirements.md:
 *   - manage:courses  → hod, director, admin, owner
 *   - manage:imports  → admin, owner
 *   - view:student-records → admin, director, owner
 *   - view:student-grades  → guardian, hod, admin, director, owner
 */
export class SeedFrontendRolePermissions1778229800000 implements MigrationInterface {
  name = 'SeedFrontendRolePermissions1778229800000';

  // All frontend-facing permission codes from the requirements spec
  private readonly permissions = [
    // owner capability set
    { code: 'manage:organization',    description: 'Full organization management access' },
    { code: 'manage:schools',         description: 'Manage all schools within an organization' },
    { code: 'manage:users',           description: 'Manage users within a school' },
    { code: 'manage:billing',         description: 'Manage billing and subscription settings' },
    { code: 'view:analytics',         description: 'View organization-level analytics' },
    { code: 'view:all-data',          description: 'View all organization data' },
    // admin capability set
    { code: 'manage:timetables',      description: 'Create and modify school timetables' },
    { code: 'manage:rooms',           description: 'Manage school rooms and venues' },
    { code: 'manage:schedules',       description: 'Manage session schedules' },
    { code: 'manage:student-records', description: 'Manage student academic records' },
    { code: 'view:reports',           description: 'View school reports' },
    { code: 'manage:announcements',   description: 'Create and manage announcements' },
    // director capability set
    { code: 'manage:school',          description: 'Manage school settings and configuration' },
    { code: 'manage:departments',     description: 'Create and manage departments' },
    { code: 'manage:staff',           description: 'Manage staff members' },
    { code: 'view:school-analytics',  description: 'View school-level analytics' },
    { code: 'view:all-school-data',   description: 'View all school data' },
    // hod capability set
    { code: 'manage:department',      description: 'Manage a specific department' },
    { code: 'manage:courses',         description: 'Create and manage courses' },
    { code: 'manage:lecturers',       description: 'Manage lecturer assignments' },
    { code: 'approve:timetables',     description: 'Approve department timetable submissions' },
    { code: 'view:department-analytics', description: 'View department-level analytics' },
    // lecturer capability set
    { code: 'manage:sessions',        description: 'Create and manage class sessions' },
    { code: 'start:session',          description: 'Start a live class session' },
    { code: 'end:session',            description: 'End a live class session' },
    { code: 'mark:attendance',        description: 'Record student attendance' },
    { code: 'view:class-roster',      description: 'View the class roster for a session' },
    { code: 'manage:course-materials', description: 'Upload and manage course materials' },
    // student capability set
    { code: 'view:timetable',         description: 'View personal timetable' },
    { code: 'view:attendance',        description: 'View personal attendance records' },
    { code: 'view:grades',            description: 'View personal grades' },
    { code: 'view:course-materials',  description: 'Access course materials' },
    { code: 'join:session',           description: 'Join a live class session' },
    // guardian capability set
    { code: 'view:linked-students',   description: 'View linked student profiles' },
    { code: 'view:student-attendance', description: 'View attendance of a linked student' },
    { code: 'view:student-grades',    description: 'View grades of a linked student' },
    { code: 'receive:notifications',  description: 'Receive guardian notifications' },
    // follower capability set
    { code: 'view:public-info',       description: 'View public school information' },
    { code: 'view:announcements',     description: 'View public announcements' },
    // gap permissions resolved
    { code: 'manage:imports',         description: 'Manage bulk data import jobs' },
    { code: 'view:student-records',   description: 'View student academic records' },
  ];

  // Role-to-permissions mapping matching ROLE_CAPABILITIES (frontend codes only)
  private readonly roleMappings: Array<{ role: string; permissions: string[] }> = [
    {
      role: 'owner',
      permissions: [
        'manage:organization', 'manage:schools', 'manage:users', 'manage:billing',
        'view:analytics', 'view:all-data',
        'manage:school', 'manage:departments', 'manage:staff', 'manage:timetables',
        'manage:rooms', 'view:school-analytics', 'view:all-school-data', 'manage:schedules',
        'manage:student-records', 'view:reports', 'manage:announcements', 'manage:department',
        'manage:courses', 'manage:lecturers', 'approve:timetables', 'view:department-analytics',
        'manage:sessions', 'start:session', 'end:session', 'mark:attendance',
        'view:class-roster', 'manage:course-materials', 'view:timetable', 'view:attendance',
        'view:grades', 'view:course-materials', 'view:linked-students', 'view:student-attendance',
        'view:student-grades', 'view:public-info', 'view:announcements',
        'manage:imports', 'view:student-records',
      ],
    },
    {
      role: 'admin',
      permissions: [
        'manage:timetables', 'manage:rooms', 'manage:schedules', 'manage:student-records',
        'view:reports', 'manage:announcements', 'manage:school', 'manage:departments',
        'manage:staff', 'view:school-analytics',
        'manage:courses', 'manage:imports', 'view:student-records', 'view:student-grades',
      ],
    },
    {
      role: 'director',
      permissions: [
        'manage:school', 'manage:departments', 'manage:staff', 'manage:timetables',
        'manage:rooms', 'view:school-analytics', 'view:all-school-data',
        'manage:courses', 'view:student-records', 'view:student-grades', 'view:reports',
      ],
    },
    {
      role: 'hod',
      permissions: [
        'manage:department', 'manage:courses', 'manage:lecturers',
        'approve:timetables', 'view:department-analytics', 'view:student-grades',
      ],
    },
    {
      role: 'lecturer',
      permissions: [
        'manage:sessions', 'start:session', 'end:session', 'mark:attendance',
        'view:class-roster', 'manage:course-materials',
      ],
    },
    {
      role: 'student',
      permissions: [
        'view:timetable', 'view:attendance', 'view:grades', 'view:course-materials', 'join:session',
      ],
    },
    {
      role: 'guardian',
      permissions: [
        'view:linked-students', 'view:student-attendance', 'view:student-grades', 'receive:notifications',
      ],
    },
    {
      role: 'follower',
      permissions: ['view:public-info', 'view:announcements'],
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Seed permission catalog
    const permValues = this.permissions
      .map((p) => `('${p.code}', '${p.description.replace(/'/g, "''")}')`)
      .join(',\n      ');

    await queryRunner.query(`
      INSERT INTO "permissions" (code, description)
      VALUES ${permValues}
      ON CONFLICT (code) DO NOTHING;
    `);

    // 2. Seed role_permissions for every existing school
    const schools: Array<{ id: string }> = await queryRunner.query('SELECT id FROM schools');

    for (const { id: schoolId } of schools) {
      for (const mapping of this.roleMappings) {
        const values = mapping.permissions
          .map((perm) => `('${schoolId}', '${mapping.role}', '${perm}')`)
          .join(',\n          ');

        await queryRunner.query(`
          INSERT INTO "role_permissions" (school_id, role, permission_id)
          VALUES ${values}
          ON CONFLICT (school_id, role, permission_id) DO NOTHING;
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = this.permissions.map((p) => `'${p.code}'`).join(', ');
    await queryRunner.query(`
      DELETE FROM "role_permissions" WHERE permission_id IN (${codes});
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE code IN (${codes});
    `);
  }
}
