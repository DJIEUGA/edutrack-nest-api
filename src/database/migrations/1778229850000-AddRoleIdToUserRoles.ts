import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds role_id and updated_at to user_roles if they are absent.
 * These columns are defined in InitialSchema but were not present in all
 * deployed databases.  role_id links a user_roles row to a dynamic_roles
 * entry when the user holds a custom (non-enum) role.
 */
export class AddRoleIdToUserRoles1778229850000 implements MigrationInterface {
  name = 'AddRoleIdToUserRoles1778229850000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_roles
        ADD COLUMN IF NOT EXISTS role_id uuid,
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_roles
        DROP COLUMN IF EXISTS role_id,
        DROP COLUMN IF EXISTS updated_at
    `);
  }
}
