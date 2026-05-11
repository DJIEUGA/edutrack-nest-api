import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAcademicFoundations1715164700000 implements MigrationInterface {
  name = 'CreateAcademicFoundations1715164700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Academic Years (Required by classes, semesters, and assignments)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "academic_years" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "name" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "name")
      )
    `);

    // 2. Venues (Required by Timetable and Sessions geofencing)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "venues" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "name" text NOT NULL,
        "latitude" numeric,
        "longitude" numeric,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "name")
      )
    `);

    // 3. Courses (Required by assignments)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "department_id" uuid REFERENCES departments(id) ON DELETE SET NULL,
        "code" text NOT NULL,
        "title" text NOT NULL,
        "unit_load" integer NOT NULL DEFAULT 2,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "code")
      )
    `);

    // 4. Course Assignments (The link between Lecturer, Course, and Class)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_assignments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "academic_year_id" uuid NOT NULL REFERENCES academic_years(id),
        "course_id" uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        "class_id" uuid NOT NULL, -- references classes table created in next migration
        "lecturer_user_id" uuid NOT NULL REFERENCES users(id),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("academic_year_id", "course_id", "class_id", "lecturer_user_id")
      )
    `);

    // 5. Timetable Slots
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "timetable_slots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "course_assignment_id" uuid NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
        "day_of_week" integer NOT NULL, -- 0-6
        "start_time" text NOT NULL, -- HH:MM
        "end_time" text NOT NULL,
        "venue" text, -- Matches venue name for current service logic
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "timetable_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venues"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "academic_years"`);
  }
}