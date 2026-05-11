import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImplementAttendanceAndResults1715165100000 implements MigrationInterface {
  name = 'ImplementAttendanceAndResults1715165100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Attendance Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attendance" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        "status" text NOT NULL, -- present, absent, late, excused
        "marked_at" TIMESTAMP NOT NULL DEFAULT now(),
        "marked_by_user_id" uuid REFERENCES users(id),
        UNIQUE("session_id", "student_id")
      )
    `);

    // 2. Student Results/Grades Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "results" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        "course_id" uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        "academic_year_id" uuid NOT NULL REFERENCES academic_years(id),
        "score" numeric,
        "grade" text,
        "metadata" jsonb, -- For specific assessment breakdowns
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("student_id", "course_id", "academic_year_id")
      )
    `);

    // Performance indices for reporting
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_session" ON "attendance"("session_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendance_student" ON "attendance"("student_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_results_student" ON "results"("student_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_results_student"`);
    await queryRunner.query(`DROP INDEX "idx_attendance_student"`);
    await queryRunner.query(`DROP INDEX "idx_attendance_session"`);
    await queryRunner.query(`DROP TABLE "results"`);
    await queryRunner.query(`DROP TABLE "attendance"`);
  }
}