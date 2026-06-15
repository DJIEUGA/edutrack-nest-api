import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameResultsToAcademicResults1778320700000 implements MigrationInterface {
  name = 'RenameResultsToAcademicResults1778320700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS "results" RENAME TO "academic_results"`);
    await queryRunner.query(`ALTER INDEX IF EXISTS "idx_results_student" RENAME TO "idx_academic_results_student"`);
    await queryRunner.query(`
      ALTER TABLE "academic_results"
        ADD COLUMN IF NOT EXISTS "recorded_by" uuid REFERENCES users(id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "academic_results" DROP COLUMN IF EXISTS "recorded_by"`);
    await queryRunner.query(`ALTER INDEX IF EXISTS "idx_academic_results_student" RENAME TO "idx_results_student"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "academic_results" RENAME TO "results"`);
  }
}
