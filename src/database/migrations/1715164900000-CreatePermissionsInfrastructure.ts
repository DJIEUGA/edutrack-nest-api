import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePermissionsInfrastructure1715164900000 implements MigrationInterface {
  name = 'CreatePermissionsInfrastructure1715164900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Permissions Catalog Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid DEFAULT uuid_generate_v4(),
        "code" text PRIMARY KEY,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Healing: Ensure 'id' column exists for standard ORM/Guard queries
    await queryRunner.query(`ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4()`);

    // 2. Dynamic Roles Table (School-specific custom roles)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dynamic_roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "code" text NOT NULL,
        "name" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "code")
      )
    `);

    // 3. User-Specific Permissions Mapping (with healing for column rename)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_permissions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "permission_id" text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE, -- Ensure this is the desired name
        "granted_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("user_id", "school_id", "permission_id")
      );
    `);

    // Healing: If 'user_permissions' table exists but has 'permission_code' instead of 'permission_id', rename it.
    // This handles cases where a previous version of the migration created 'permission_code'.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'permission_code') AND
           NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'permission_id') THEN
            ALTER TABLE "user_permissions" RENAME COLUMN "permission_code" TO "permission_id";
        END IF;
      END $$;
    `);

    // Healing: Ensure 'permission_id' column exists and is correctly constrained if it was missing or renamed.
    await queryRunner.query(`ALTER TABLE "user_permissions" ADD COLUMN IF NOT EXISTS "permission_id" text`);
    await queryRunner.query(`ALTER TABLE "user_permissions" ALTER COLUMN "permission_id" SET NOT NULL`);
    await queryRunner.query(`
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_permissions_permission_id' AND conrelid = 'user_permissions'::regclass) THEN
        ALTER TABLE "user_permissions" ADD CONSTRAINT "FK_user_permissions_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions"("code") ON DELETE CASCADE;
      END IF; END $$;
    `);
    
    // Healing: Add unique constraint if it doesn't exist (and if it wasn't added by CREATE TABLE)
    await queryRunner.query(`
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_permissions_user_id_school_id_permission_id_key' AND conrelid = 'user_permissions'::regclass) THEN
        ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_school_id_permission_id_key" UNIQUE ("user_id", "school_id", "permission_id");
      END IF; END $$;
    `);

    // 4. Role-Based Permissions Mapping
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        "role" text NOT NULL, -- Can be a standard enum role or dynamic role code
        "permission_id" text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("school_id", "role", "permission_id")
      )
    `);

    // Healing: If 'role_permissions' table exists but has 'permission_code' instead of 'permission_id', rename it.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'role_permissions' AND column_name = 'permission_code') AND
           NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'role_permissions' AND column_name = 'permission_id') THEN
            ALTER TABLE "role_permissions" RENAME COLUMN "permission_code" TO "permission_id";
        END IF;
      END $$;
    `);

    // Healing: Ensure 'permission_id' column exists and is correctly constrained for role_permissions
    await queryRunner.query(`ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "permission_id" text`);
    await queryRunner.query(`ALTER TABLE "role_permissions" ALTER COLUMN "permission_id" SET NOT NULL`);
    await queryRunner.query(`
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_role_permissions_permission_id' AND conrelid = 'role_permissions'::regclass) THEN
        ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions"("code") ON DELETE CASCADE;
      END IF; END $$;
    `);

    // Healing: Add unique constraint if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_school_id_role_permission_id_key' AND conrelid = 'role_permissions'::regclass) THEN
        ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_school_id_role_permission_id_key" UNIQUE ("school_id", "role", "permission_id");
      END IF; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dynamic_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}