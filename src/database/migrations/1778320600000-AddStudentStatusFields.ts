import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentStatusFields1778320600000 implements MigrationInterface {
  name = 'AddStudentStatusFields1778320600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE students
        ADD CONSTRAINT chk_student_status
          CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS chk_student_status`);
    await queryRunner.query(`ALTER TABLE students DROP COLUMN IF EXISTS rejection_reason`);
    await queryRunner.query(`ALTER TABLE students DROP COLUMN IF EXISTS status`);
  }
}
