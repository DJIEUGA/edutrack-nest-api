import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuardianStudentsAndInvitations1715165200000 implements MigrationInterface {
  name = 'CreateGuardianStudentsAndInvitations1715165200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Guardian-Student Relationship Table (Section 13 of Integration Guide)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_students" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "guardian_user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("guardian_user_id", "student_id", "school_id")
      )
    `);

    // 2. Invitations Table (Section 7.8 of Integration Guide)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invitations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "department_id" uuid REFERENCES departments(id) ON DELETE SET NULL,
        "email" text NOT NULL,
        "role" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "token" text UNIQUE NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "chk_invitation_status" CHECK (status IN ('pending', 'accepted', 'cancelled'))
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_guardian_students_lookup" ON "guardian_students"("guardian_user_id", "school_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_invitations_email" ON "invitations"("email")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guardian_students"`);
  }
}