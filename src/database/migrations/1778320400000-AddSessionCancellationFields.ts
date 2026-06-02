import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionCancellationFields1778320400000 implements MigrationInterface {
  name = 'AddSessionCancellationFields1778320400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
        ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS cancelled_by`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS cancellation_reason`);
  }
}
