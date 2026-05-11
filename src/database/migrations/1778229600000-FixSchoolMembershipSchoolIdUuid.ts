import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSchoolMembershipSchoolIdUuid1778229600000 implements MigrationInterface {
  name = 'FixSchoolMembershipSchoolIdUuid1778229600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'school_memberships'
            AND column_name = 'school_id'
            AND data_type = 'text'
        ) THEN
          IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'school_memberships_school_id_fkey'
              AND conrelid = 'school_memberships'::regclass
          ) THEN
            ALTER TABLE "school_memberships" DROP CONSTRAINT "school_memberships_school_id_fkey";
          END IF;

          ALTER TABLE "school_memberships"
            ALTER COLUMN "school_id" TYPE uuid USING "school_id"::uuid;

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'school_memberships_school_id_fkey'
              AND conrelid = 'school_memberships'::regclass
          ) THEN
            ALTER TABLE "school_memberships"
              ADD CONSTRAINT "school_memberships_school_id_fkey"
              FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE;
          END IF;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'school_memberships'
            AND column_name = 'school_id'
            AND data_type = 'uuid'
        ) THEN
          IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'school_memberships_school_id_fkey'
              AND conrelid = 'school_memberships'::regclass
          ) THEN
            ALTER TABLE "school_memberships" DROP CONSTRAINT "school_memberships_school_id_fkey";
          END IF;

          ALTER TABLE "school_memberships"
            ALTER COLUMN "school_id" TYPE text USING "school_id"::text;

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'school_memberships_school_id_fkey'
              AND conrelid = 'school_memberships'::regclass
          ) THEN
            ALTER TABLE "school_memberships"
              ADD CONSTRAINT "school_memberships_school_id_fkey"
              FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE;
          END IF;
        END IF;
      END $$;
    `);
  }
}