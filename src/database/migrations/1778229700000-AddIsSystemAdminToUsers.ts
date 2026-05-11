import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsSystemAdminToUsers1778229700000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_system_admin boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS is_system_admin
    `);
  }
}
