import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInitialPermissions1715165500000 implements MigrationInterface {
  name = 'SeedInitialPermissions1715165500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const permissions = [
      // Core Permissions (from CreatePermissionsInfrastructure and general usage)
      { code: 'reports:export', description: 'Can export report data' },
      { code: 'attendance:mark', description: 'Can record student attendance' },
      { code: 'sessions:manage', description: 'Can create and edit class sessions' },
      { code: 'timetable:manage', description: 'Can modify school timetable slots' },

      // Departments
      { code: 'department:create', description: 'Can create new departments' },
      { code: 'department:read', description: 'Can view department details' },
      { code: 'department:update', description: 'Can update department details' },
      { code: 'department:delete', description: 'Can delete departments' },

      // Courses
      { code: 'course:create', description: 'Can create new courses' },
      { code: 'course:read', description: 'Can view course details' },
      { code: 'course:update', description: 'Can update course details' },
      { code: 'course:delete', description: 'Can delete courses' },

      // Programs
      { code: 'program:create', description: 'Can create new academic programs' },
      { code: 'program:read', description: 'Can view academic program details' },
      { code: 'program:update', description: 'Can update academic program details' },
      { code: 'program:delete', description: 'Can delete academic programs' },

      // Classes
      { code: 'class:create', description: 'Can create new classes' },
      { code: 'class:read', description: 'Can view class details' },
      { code: 'class:update', description: 'Can update class details' },
      { code: 'class:delete', description: 'Can delete classes' },

      // Semesters
      { code: 'semester:create', description: 'Can create new semesters' },
      { code: 'semester:read', description: 'Can view semester details' },
      { code: 'semester:update', description: 'Can update semester details' },

      // Organization
      { code: 'organization:update', description: 'Can update organization details' },
      { code: 'organization:delete', description: 'Can delete an organization' },

      // Student Attendance Summary
      { code: 'student:attendance:summary:read', description: 'Can view individual student attendance summaries' },
      { code: 'school:attendance:summary:read', description: 'Can view school-wide student attendance summaries' },

      // Reports
      { code: 'report:enrollment:read', description: 'Can view enrollment reports' },
      { code: 'report:attendance:read', description: 'Can view attendance reports' },
      { code: 'report:geo-compliance:read', description: 'Can view geo-compliance reports' },

      // Venues
      { code: 'venue:create', description: 'Can create new venues' },
      { code: 'venue:read', description: 'Can view venue details' },
      { code: 'venue:update', description: 'Can update venue details' },
      { code: 'venue:delete', description: 'Can delete venues' },

      // Invitation
      { code: 'invitation:create', description: 'Can create staff invitations' },
      { code: 'invitation:read', description: 'Can view staff invitations' },
      { code: 'invitation:delete', description: 'Can delete staff invitations' },

      // Schools (Extended CRUD)
      { code: 'school:create', description: 'Can create new schools' },
      { code: 'school:read', description: 'Can view school details' },
      { code: 'school:update', description: 'Can update school details' },
      { code: 'school:delete', description: 'Can delete schools (soft delete)' },
      { code: 'school:logo:upload', description: 'Can upload school logo' },
      { code: 'school:logo:delete', description: 'Can delete school logo' },

      // System Global Administration
      { code: 'system:organization:read', description: 'Can view all organizations (system-wide)' },
      { code: 'system:organization:update', description: 'Can update organization status (system-wide)' },
      { code: 'system:organization:delete', description: 'Can soft delete organizations (system-wide)' },
      { code: 'system:user:read', description: 'Can view all users (system-wide)' },
      { code: 'system:user:update', description: 'Can toggle system admin status for users' },
      { code: 'system:stats:read', description: 'Can view platform-wide statistics' },

      // User Context & Permissions
      { code: 'permission:read:self', description: 'Can view own permissions for a school' },

      // Staff Users
      { code: 'user:read', description: 'Can view staff user details within a school' },
      { code: 'user:create', description: 'Can create new staff users within a school' },
      { code: 'user:update', description: 'Can update staff user details within a school' },
      { code: 'user:delete', description: 'Can remove staff users from a school' },
      { code: 'user:password:reset', description: 'Can reset staff user passwords within a school' },

      // Roles & Permissions (School-scoped)
      { code: 'user:role:read', description: 'Can view user role assignments within a school' },
      { code: 'user:role:assign', description: 'Can assign roles to users within a school' },
      { code: 'user:role:revoke', description: 'Can revoke roles from users within a school' },
      { code: 'permission:catalog:read', description: 'Can view the catalog of available permissions' },
      { code: 'permission:create', description: 'Can create new custom permissions' },
      { code: 'user:permission:assign', description: 'Can assign specific permissions to users' },
      { code: 'user:permission:revoke', description: 'Can revoke specific permissions from users' },
      { code: 'role:catalog:read', description: 'Can view the catalog of dynamic roles' },
      { code: 'role:create', description: 'Can create new dynamic roles' },
      { code: 'permission:bulk-assign-role', description: 'Can assign permissions to all users with a specific role' },

      // Academic Years
      { code: 'academic-year:create', description: 'Can create new academic years' },
      { code: 'academic-year:read', description: 'Can view academic year details' },
      { code: 'academic-year:update', description: 'Can update academic year details' },

      // Timetable
      { code: 'timetable:slot:create', description: 'Can create new timetable slots' },
      { code: 'timetable:slot:read', description: 'Can view timetable slots' },
      { code: 'timetable:slot:update', description: 'Can update timetable slots' },
      { code: 'timetable:slot:delete', description: 'Can delete timetable slots' },

      // Sessions
      { code: 'session:create', description: 'Can create new sessions' },
      { code: 'session:read', description: 'Can view session details' },
      { code: 'session:start', description: 'Can start a session' },
      { code: 'session:end', description: 'Can end a session' },

      // Attendance
      { code: 'attendance:record:read', description: 'Can view attendance records for sessions' },
      { code: 'attendance:student:read', description: 'Can view individual student attendance history' },
      { code: 'attendance:record:create', description: 'Can mark attendance for a single student' },
      { code: 'attendance:record:bulk-create', description: 'Can mark attendance for multiple students' },

      // Results
      { code: 'result:bulk:create', description: 'Can submit bulk results' },
      { code: 'result:student:read', description: 'Can view individual student results' },

      // Bulk Imports
      { code: 'import:job:read', description: 'Can view import job status' },
      { code: 'import:job:create', description: 'Can create new import jobs' },
      { code: 'import:job:commit', description: 'Can commit import jobs' },
      { code: 'import:job:delete', description: 'Can delete import jobs' },

      // Audit Logs
      { code: 'audit:log:read', description: 'Can view audit logs' },
    ];

    // Use a single INSERT statement for efficiency
    const values = permissions.map(p => `('${p.code}', '${p.description}')`).join(',');
    await queryRunner.query(`
      INSERT INTO "permissions" (code, description) 
      VALUES ${values}
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // For foundational seed data, the down migration is often left empty
    // or performs a selective delete if the data is not critical for schema rollback.
    // For now, we'll leave it empty as these permissions are expected to persist.
  }
}