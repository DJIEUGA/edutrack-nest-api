import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultRolePermissions1715165600000 implements MigrationInterface {
  name = 'SeedDefaultRolePermissions1715165600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fetch all existing schools to apply default roles and permissions
    const schools = await queryRunner.query('SELECT id FROM schools');

    for (const school of schools) {
      const schoolId = school.id;

      // 1. Seed common "Dynamic Roles" that aren't in the base enum but are standard for schools
      await queryRunner.query(`
        INSERT INTO "dynamic_roles" (school_id, code, name)
        VALUES 
          ('${schoolId}', 'exam-officer', 'Exam Officer'),
          ('${schoolId}', 'bursar', 'Bursar / Accountant'),
          ('${schoolId}', 'registrar', 'Registrar')
        ON CONFLICT (school_id, code) DO NOTHING;
      `);

      // 2. Define default permission mappings for roles
      // We use the 'role' string which works for both base enum roles and dynamic role codes
      const roleMappings = [
        {
          role: 'admin',
          permissions: [
            'user:read', 'user:create', 'user:update', 'user:delete',
            'school:read', 'school:update',
            'academic-year:read', 'academic-year:create', 'academic-year:update',
            'department:read', 'department:create', 'department:update',
            'course:read', 'course:create', 'course:update',
            'class:read', 'class:create', 'class:update',
            'invitation:read', 'invitation:create', 'invitation:delete',
            'venue:read', 'venue:create', 'venue:update',
            'import:job:read', 'import:job:create',
            'audit:log:read', 'report:attendance:read', 'report:enrollment:read'
          ],
        },
        {
          role: 'lecturer',
          permissions: [
            'session:read', 'session:start', 'session:end',
            'attendance:mark', 'attendance:record:read', 'attendance:record:bulk-create',
            'timetable:slot:read', 'course:read', 'venue:read',
            'result:bulk:create', 'student:attendance:summary:read'
          ],
        },
        {
          role: 'hod',
          permissions: [
            'department:read', 'department:update',
            'course:read', 'course:update',
            'program:read', 'program:update',
            'timetable:manage', 'timetable:slot:read',
            'session:read', 'attendance:record:read',
            'student:attendance:summary:read'
          ],
        },
        {
          role: 'student',
          permissions: [
            'timetable:slot:read', 'session:read',
            'attendance:student:read', 'result:student:read',
            'permission:read:self'
          ],
        },
        {
          role: 'exam-officer',
          permissions: [
            'result:bulk:create', 'result:student:read',
            'course:read', 'class:read', 'academic-year:read'
          ],
        }
      ];

      for (const mapping of roleMappings) {
        const values = mapping.permissions
          .map((perm) => `('${schoolId}', '${mapping.role}', '${perm}')`)
          .join(',');

        if (values) {
          await queryRunner.query(`
            INSERT INTO "role_permissions" (school_id, role, permission_id)
            VALUES ${values}
            ON CONFLICT (school_id, role, permission_id) DO NOTHING;
          `);
        }
      }

    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This would typically involve removing the seeded records
    // However, in multi-tenant migrations, a 'down' that deletes shared data 
    // can be destructive, so it's often preferred to keep it empty or 
    // highly specific.
  }
}