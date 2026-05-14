import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the frontend-facing permission codes (manage:X, view:X, etc.) that
 * the client checks for navigation visibility.
 *
 * This migration is schema-aware: if it finds the legacy UUID-FK schema
 * (role_id uuid + permission_id uuid) it restructures both role_permissions
 * and user_permissions to the text-based schema before seeding.
 * It is safe to run on databases that already have the correct schema.
 *
 * Also resolves the gap permissions identified in docs/role-permissions-requirements.md.
 */
export class SeedFrontendRolePermissions1778229800000 implements MigrationInterface {
  name = 'SeedFrontendRolePermissions1778229800000';

  private readonly permissions = [
    { code: 'manage:organization',       description: 'Full organization management access' },
    { code: 'manage:schools',            description: 'Manage all schools within an organization' },
    { code: 'manage:users',              description: 'Manage users within a school' },
    { code: 'manage:billing',            description: 'Manage billing and subscription settings' },
    { code: 'view:analytics',            description: 'View organization-level analytics' },
    { code: 'view:all-data',             description: 'View all organization data' },
    { code: 'manage:timetables',         description: 'Create and modify school timetables' },
    { code: 'manage:rooms',              description: 'Manage school rooms and venues' },
    { code: 'manage:schedules',          description: 'Manage session schedules' },
    { code: 'manage:student-records',    description: 'Manage student academic records' },
    { code: 'view:reports',              description: 'View school reports' },
    { code: 'manage:announcements',      description: 'Create and manage announcements' },
    { code: 'manage:school',             description: 'Manage school settings and configuration' },
    { code: 'manage:departments',        description: 'Create and manage departments' },
    { code: 'manage:staff',              description: 'Manage staff members' },
    { code: 'view:school-analytics',     description: 'View school-level analytics' },
    { code: 'view:all-school-data',      description: 'View all school data' },
    { code: 'manage:department',         description: 'Manage a specific department' },
    { code: 'manage:courses',            description: 'Create and manage courses' },
    { code: 'manage:lecturers',          description: 'Manage lecturer assignments' },
    { code: 'approve:timetables',        description: 'Approve department timetable submissions' },
    { code: 'view:department-analytics', description: 'View department-level analytics' },
    { code: 'manage:sessions',           description: 'Create and manage class sessions' },
    { code: 'start:session',             description: 'Start a live class session' },
    { code: 'end:session',               description: 'End a live class session' },
    { code: 'mark:attendance',           description: 'Record student attendance' },
    { code: 'view:class-roster',         description: 'View the class roster for a session' },
    { code: 'manage:course-materials',   description: 'Upload and manage course materials' },
    { code: 'view:timetable',            description: 'View personal timetable' },
    { code: 'view:attendance',           description: 'View personal attendance records' },
    { code: 'view:grades',               description: 'View personal grades' },
    { code: 'view:course-materials',     description: 'Access course materials' },
    { code: 'join:session',              description: 'Join a live class session' },
    { code: 'view:linked-students',      description: 'View linked student profiles' },
    { code: 'view:student-attendance',   description: 'View attendance of a linked student' },
    { code: 'view:student-grades',       description: 'View grades of a linked student' },
    { code: 'receive:notifications',     description: 'Receive guardian notifications' },
    { code: 'view:public-info',          description: 'View public school information' },
    { code: 'view:announcements',        description: 'View public announcements' },
    { code: 'manage:imports',            description: 'Manage bulk data import jobs' },
    { code: 'view:student-records',      description: 'View student academic records' },
  ];

  private readonly roleMappings: Array<{ role: string; permissions: string[] }> = [
    {
      role: 'owner',
      permissions: [
        'manage:organization', 'manage:schools', 'manage:users', 'manage:billing',
        'view:analytics', 'view:all-data', 'manage:school', 'manage:departments',
        'manage:staff', 'manage:timetables', 'manage:rooms', 'view:school-analytics',
        'view:all-school-data', 'manage:schedules', 'manage:student-records', 'view:reports',
        'manage:announcements', 'manage:department', 'manage:courses', 'manage:lecturers',
        'approve:timetables', 'view:department-analytics', 'manage:sessions', 'start:session',
        'end:session', 'mark:attendance', 'view:class-roster', 'manage:course-materials',
        'view:timetable', 'view:attendance', 'view:grades', 'view:course-materials',
        'view:linked-students', 'view:student-attendance', 'view:student-grades',
        'view:public-info', 'view:announcements', 'manage:imports', 'view:student-records',
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
    // ── Step 1: Detect and fix role_permissions schema if needed ──────────────
    const rpCols: Array<{ column_name: string }> = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'role_permissions' AND table_schema = 'public'
    `);
    const rpColNames = rpCols.map((c) => c.column_name);

    if (!rpColNames.includes('school_id')) {
      await this.restructureRolePermissions(queryRunner);
    }

    // ── Step 2: Detect and fix user_permissions.permission_id if needed ───────
    const upPermCol: Array<{ data_type: string }> = await queryRunner.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'user_permissions' AND column_name = 'permission_id'
        AND table_schema = 'public'
    `);
    if (upPermCol.length > 0 && upPermCol[0].data_type === 'uuid') {
      await this.restructureUserPermissions(queryRunner);
    }

    // ── Step 3: Seed permission catalog ──────────────────────────────────────
    const permValues = this.permissions
      .map((p) => `('${p.code}', '${p.description.replace(/'/g, "''")}')`)
      .join(',\n      ');

    await queryRunner.query(`
      INSERT INTO "permissions" (code, description)
      VALUES ${permValues}
      ON CONFLICT (code) DO NOTHING;
    `);

    // ── Step 4: Seed role_permissions for every existing school ───────────────
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

  /**
   * Converts role_permissions from the legacy UUID-FK schema
   * (role_id uuid → roles.id, permission_id uuid → permissions.id)
   * to the text-based schema
   * (school_id uuid, role text, permission_id text → permissions.code).
   */
  private async restructureRolePermissions(queryRunner: QueryRunner): Promise<void> {
    // Drop old constraints
    await queryRunner.query(`
      ALTER TABLE role_permissions
        DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey,
        DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey,
        DROP CONSTRAINT IF EXISTS role_permissions_role_id_permission_id_key
    `);

    // Add new text columns alongside the old ones
    await queryRunner.query(`
      ALTER TABLE role_permissions
        ADD COLUMN IF NOT EXISTS school_id uuid,
        ADD COLUMN IF NOT EXISTS role text,
        ADD COLUMN IF NOT EXISTS permission_code text
    `);

    // Migrate existing data via joins (role_id → roles, permission_id → permissions)
    await queryRunner.query(`
      UPDATE role_permissions rp
      SET
        school_id    = r.school_id,
        role         = r.code,
        permission_code = p.code
      FROM roles r, permissions p
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
    `);

    // Remove rows that couldn't be migrated (orphaned FKs)
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE school_id IS NULL OR role IS NULL OR permission_code IS NULL
    `);

    // Drop the old UUID columns
    await queryRunner.query(`
      ALTER TABLE role_permissions
        DROP COLUMN IF EXISTS role_id,
        DROP COLUMN IF EXISTS permission_id
    `);

    // Rename permission_code → permission_id
    await queryRunner.query(`
      ALTER TABLE role_permissions RENAME COLUMN permission_code TO permission_id
    `);

    // Apply NOT NULL
    await queryRunner.query(`
      ALTER TABLE role_permissions
        ALTER COLUMN school_id    SET NOT NULL,
        ALTER COLUMN role         SET NOT NULL,
        ALTER COLUMN permission_id SET NOT NULL
    `);

    // Add new FK and UNIQUE constraints
    await queryRunner.query(`
      ALTER TABLE role_permissions
        ADD CONSTRAINT fk_role_permissions_school
          FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_role_permissions_perm
          FOREIGN KEY (permission_id) REFERENCES permissions(code) ON DELETE CASCADE,
        ADD CONSTRAINT uq_role_permissions
          UNIQUE (school_id, role, permission_id)
    `);
  }

  /**
   * Converts user_permissions.permission_id from UUID (→ permissions.id)
   * to text (→ permissions.code), matching what the service layer expects.
   */
  private async restructureUserPermissions(queryRunner: QueryRunner): Promise<void> {
    // Drop old FK and UNIQUE constraint
    await queryRunner.query(`
      ALTER TABLE user_permissions
        DROP CONSTRAINT IF EXISTS user_permissions_permission_id_fkey,
        DROP CONSTRAINT IF EXISTS user_permissions_user_id_school_id_permission_id_key
    `);

    // Add a staging text column
    await queryRunner.query(`
      ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS permission_code text
    `);

    // Populate the text column from the permissions table
    await queryRunner.query(`
      UPDATE user_permissions up
      SET permission_code = p.code
      FROM permissions p
      WHERE up.permission_id = p.id
    `);

    // Remove rows that couldn't be resolved
    await queryRunner.query(`
      DELETE FROM user_permissions WHERE permission_code IS NULL
    `);

    // Drop the UUID column
    await queryRunner.query(`
      ALTER TABLE user_permissions DROP COLUMN IF EXISTS permission_id
    `);

    // Rename staging column
    await queryRunner.query(`
      ALTER TABLE user_permissions RENAME COLUMN permission_code TO permission_id
    `);

    // Apply NOT NULL
    await queryRunner.query(`
      ALTER TABLE user_permissions ALTER COLUMN permission_id SET NOT NULL
    `);

    // Restore FK and UNIQUE constraints
    await queryRunner.query(`
      ALTER TABLE user_permissions
        ADD CONSTRAINT fk_user_permissions_perm
          FOREIGN KEY (permission_id) REFERENCES permissions(code) ON DELETE CASCADE,
        ADD CONSTRAINT uq_user_permissions
          UNIQUE (user_id, school_id, permission_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = this.permissions.map((p) => `'${p.code}'`).join(', ');
    await queryRunner.query(`DELETE FROM "role_permissions" WHERE permission_id IN (${codes})`);
    await queryRunner.query(`DELETE FROM "permissions" WHERE code IN (${codes})`);
  }
}
