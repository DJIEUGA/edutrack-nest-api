import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixVenuesSchoolIdType1715165300000 implements MigrationInterface {
  name = 'FixVenuesSchoolIdType1715165300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Healing: Ensure venues.school_id is a UUID to prevent "operator does not exist: text = uuid" errors.
    // This is idempotent: it checks if the column is currently 'text' before attempting the cast.
    await queryRunner.query(`
      DO $$ 
      BEGIN 
        IF (SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'venues' AND column_name = 'school_id') = 'text' 
        THEN
          ALTER TABLE "venues" ALTER COLUMN "school_id" TYPE uuid USING "school_id"::uuid;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "venues" ALTER COLUMN "school_id" TYPE text`);
  }
}