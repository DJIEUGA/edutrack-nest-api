import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImplementCoreAcademicAndSystemTables1715165000000 implements MigrationInterface {
  name = 'ImplementCoreAcademicAndSystemTables1715165000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Programs Table (Section 3 of Integration Guide)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "programs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "department_id" uuid REFERENCES departments(id) ON DELETE SET NULL,
        "code" text NOT NULL,
        "name" text NOT NULL,
        "duration_years" integer NOT NULL DEFAULT 4,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "code")
      )
    `);

    // 2. Classes Table (Section 4 of Integration Guide)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "classes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "academic_year_id" uuid NOT NULL REFERENCES academic_years(id),
        "program_id" uuid REFERENCES programs(id) ON DELETE SET NULL,
        "name" text NOT NULL,
        "level" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "academic_year_id", "name")
      )
    `);

    // 3. Semesters Table (Section 5 of Integration Guide)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "semesters" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "academic_year_id" uuid NOT NULL REFERENCES academic_years(id),
        "name" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_current" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // 4. Import Jobs Table (Referenced in ImportsService)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "import_jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "initiated_by" uuid NOT NULL REFERENCES users(id),
        "type" text NOT NULL, -- students, staff, courses, timetable
        "status" text NOT NULL DEFAULT 'pending', 
        "source_file_url" text,
        "errors" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "chk_import_status" CHECK (status IN ('pending', 'processing', 'awaiting_confirmation', 'committed', 'failed'))
      )
    `);

    // 5. Sessions Table (Referenced in SessionsService)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "course_assignment_id" uuid NOT NULL REFERENCES course_assignments(id),
        "timetable_slot_id" uuid REFERENCES timetable_slots(id) ON DELETE SET NULL,
        "scheduled_date" date NOT NULL,
        "status" text NOT NULL DEFAULT 'scheduled',
        "actual_start" TIMESTAMP,
        "actual_end" TIMESTAMP,
        "started_by" uuid REFERENCES users(id),
        "ended_by" uuid REFERENCES users(id),
        "start_lat" numeric,
        "start_lng" numeric,
        "start_accuracy" numeric,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "chk_session_status" CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled'))
      )
    `);

    // 6. Audit Logs (Used across Sessions/Students Services)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid NOT NULL REFERENCES users(id),
        "scope_school_id" uuid REFERENCES schools(id) ON DELETE CASCADE,
        "action" text NOT NULL,
        "resource_type" text NOT NULL,
        "resource_id" uuid,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_school" ON "audit_logs"("scope_school_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_date" ON "sessions"("scheduled_date")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "semesters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "classes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "programs"`);
  }
}