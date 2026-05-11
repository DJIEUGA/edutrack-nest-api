import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureSchoolIdUuidConsistency1715165400000 implements MigrationInterface {
  name = 'EnsureSchoolIdUuidConsistency1715165400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // List of tables that are expected to have a 'school_id' column
    const tablesWithSchoolId = [
      'user_roles',
      'academic_years',
      'departments',
      'courses',
      'course_assignments',
      'classes',
      'students',
      'timetable_slots',
      'sessions',
      'invitations',
      'dynamic_roles', // Already UUID in CreatePermissionsInfrastructure, but good for idempotency
      'user_permissions', // Already UUID in CreatePermissionsInfrastructure, but good for idempotency
      'role_permissions', // Already UUID in CreatePermissionsInfrastructure, but good for idempotency
      'venues', // Already handled by FixVenuesSchoolIdType, but good for idempotency
    ];

    for (const tableName of tablesWithSchoolId) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'school_id' AND data_type = 'text') THEN
            ALTER TABLE "${tableName}" ALTER COLUMN "school_id" TYPE uuid USING "school_id"::uuid;
          END IF;
        END $$;
      `);
    }

    // Handle audit_logs separately as it uses 'scope_school_id'
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'scope_school_id' AND data_type = 'text') THEN
          ALTER TABLE "audit_logs" ALTER COLUMN "scope_school_id" TYPE uuid USING "scope_school_id"::uuid;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to text if necessary (though generally not recommended for UUIDs)
    const tablesWithSchoolId = [
      'user_roles', 'academic_years', 'departments', 'courses', 'course_assignments',
      'classes', 'students', 'timetable_slots', 'sessions', 'invitations',
      'dynamic_roles', 'user_permissions', 'role_permissions', 'venues',
    ];

    for (const tableName of tablesWithSchoolId) {
      await queryRunner.query(`ALTER TABLE "${tableName}" ALTER COLUMN "school_id" TYPE text`);
    }

    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "scope_school_id" TYPE text`);
  }
}