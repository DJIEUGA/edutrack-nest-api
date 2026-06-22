import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassDelegateAndScheduleConfig1778320800000 implements MigrationInterface {
  name = 'AddClassDelegateAndScheduleConfig1778320800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE classes
        ADD COLUMN IF NOT EXISTS delegate_student_id uuid REFERENCES students(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE school_schedule_days (
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        PRIMARY KEY (school_id, day_of_week)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE school_time_blocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        label text,
        start_time time NOT NULL,
        end_time time NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (school_id, start_time, end_time)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_time_blocks_school ON school_time_blocks(school_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_time_blocks_school`);
    await queryRunner.query(`DROP TABLE IF EXISTS school_time_blocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS school_schedule_days`);
    await queryRunner.query(`ALTER TABLE classes DROP COLUMN IF EXISTS delegate_student_id`);
  }
}
