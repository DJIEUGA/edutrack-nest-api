import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePermissionsInfrastructure1715164900000 implements MigrationInterface {
  name = 'CreatePermissionsInfrastructure1715164900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // All tables below are created by InitialSchema with the correct schema.
    // These IF NOT EXISTS guards are kept so this migration remains safe to run
    // on databases that may have been initialised without the full InitialSchema.

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" text NOT NULL UNIQUE,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dynamic_roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "code" text NOT NULL,
        "name" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "role" text NOT NULL,
        "permission_id" text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "role", "permission_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "school_id" uuid REFERENCES schools(id) ON DELETE CASCADE,
        "permission_id" text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("user_id", "school_id", "permission_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dynamic_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}
