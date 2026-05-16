import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClassManagementEnhancements1778230000000 implements MigrationInterface {
  name = 'ClassManagementEnhancements1778230000000';

  private readonly newPermissions = [
    { code: 'manage:classes', description: 'Create, update, delete, and split classes' },
    { code: 'view:classmates', description: 'View other students in the same class' },
    { code: 'manage:enrollments', description: 'Approve or reject class enrollment requests' },
  ];

  private readonly rolePermissionAdditions: Array<{ role: string; permissions: string[] }> = [
    { role: 'owner',    permissions: ['manage:classes', 'view:classmates', 'manage:enrollments'] },
    { role: 'admin',    permissions: ['manage:classes', 'view:classmates', 'manage:enrollments'] },
    { role: 'director', permissions: ['manage:classes', 'view:classmates', 'manage:enrollments'] },
    { role: 'hod',      permissions: ['manage:classes', 'view:classmates'] },
    { role: 'lecturer', permissions: ['view:classmates'] },
    { role: 'student',  permissions: ['view:classmates'] },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Extend classes table ───────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE classes
        ADD COLUMN IF NOT EXISTS max_capacity   integer,
        ADD COLUMN IF NOT EXISTS parent_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS is_group       boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS split_at       timestamptz,
        ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_classes_parent
        ON classes(parent_class_id)
        WHERE parent_class_id IS NOT NULL
    `);

    // ── 2. Enrollment requests table ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_enrollment_requests (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id     uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id    uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id      uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        status        text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'approved', 'rejected')),
        requested_by  uuid        NOT NULL REFERENCES users(id),
        reviewed_by   uuid        REFERENCES users(id),
        reviewed_at   timestamptz,
        notes         text,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_requests_class
        ON class_enrollment_requests(class_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_requests_student
        ON class_enrollment_requests(student_id)
    `);

    // ── 3. Class transfer log table ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_transfer_logs (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id       uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id      uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        from_class_id   uuid        REFERENCES classes(id) ON DELETE SET NULL,
        to_class_id     uuid        REFERENCES classes(id) ON DELETE SET NULL,
        reason          text,
        transferred_by  uuid        NOT NULL REFERENCES users(id),
        transferred_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_transfer_logs_student
        ON class_transfer_logs(student_id)
    `);

    // ── 4. updated_at triggers ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER trg_class_enrollment_requests_updated_at
        BEFORE UPDATE ON class_enrollment_requests
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ── 5. Seed new permissions ───────────────────────────────────────────────
    const permValues = this.newPermissions
      .map((p) => `('${p.code}', '${p.description.replace(/'/g, "''")}')`)
      .join(',\n      ');

    await queryRunner.query(`
      INSERT INTO permissions (code, description)
      VALUES ${permValues}
      ON CONFLICT (code) DO NOTHING
    `);

    // ── 6. Seed role_permissions for every existing school ────────────────────
    const schools: Array<{ id: string }> = await queryRunner.query('SELECT id FROM schools');

    for (const { id: schoolId } of schools) {
      for (const mapping of this.rolePermissionAdditions) {
        if (mapping.permissions.length === 0) continue;

        const values = mapping.permissions
          .map((perm) => `('${schoolId}', '${mapping.role}', '${perm}')`)
          .join(',\n          ');

        await queryRunner.query(`
          INSERT INTO role_permissions (school_id, role, permission_id)
          VALUES ${values}
          ON CONFLICT (school_id, role, permission_id) DO NOTHING
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = this.newPermissions.map((p) => `'${p.code}'`).join(', ');
    await queryRunner.query(`DELETE FROM role_permissions WHERE permission_id IN (${codes})`);
    await queryRunner.query(`DELETE FROM permissions WHERE code IN (${codes})`);

    await queryRunner.query(`DROP TABLE IF EXISTS class_transfer_logs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS class_enrollment_requests CASCADE`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_classes_parent`);
    await queryRunner.query(`
      ALTER TABLE classes
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS split_at,
        DROP COLUMN IF EXISTS is_group,
        DROP COLUMN IF EXISTS parent_class_id,
        DROP COLUMN IF EXISTS max_capacity
    `);
  }
}
