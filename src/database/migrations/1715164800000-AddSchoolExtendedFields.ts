import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds extended fields to the schools table as required by Section 15.2 
 * of the frontend integration requirements.
 */
export class AddSchoolExtendedFields1715164800000 implements MigrationInterface {
  name = 'AddSchoolExtendedFields1715164800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE schools 
      ADD COLUMN IF NOT EXISTS address text,
      ADD COLUMN IF NOT EXISTS phone text,
      ADD COLUMN IF NOT EXISTS email text,
      ADD COLUMN IF NOT EXISTS website text,
      ADD COLUMN IF NOT EXISTS logo_url text,
      ADD COLUMN IF NOT EXISTS timezone text,
      ADD COLUMN IF NOT EXISTS session_duration_minutes integer,
      ADD COLUMN IF NOT EXISTS late_threshold_minutes integer,
      ADD COLUMN IF NOT EXISTS require_geo_checkin boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS allow_late_checkin boolean NOT NULL DEFAULT true
    `);

    // Add check constraints for business logic defined in Section 15.2
    await queryRunner.query(`
      ALTER TABLE schools
      ADD CONSTRAINT chk_session_duration CHECK (session_duration_minutes >= 5 AND session_duration_minutes <= 480),
      ADD CONSTRAINT chk_late_threshold CHECK (late_threshold_minutes >= 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE schools
      DROP CONSTRAINT IF EXISTS chk_session_duration,
      DROP CONSTRAINT IF EXISTS chk_late_threshold
    `);
    
    await queryRunner.query(`
      ALTER TABLE schools 
      DROP COLUMN IF EXISTS address,
      DROP COLUMN IF EXISTS phone,
      DROP COLUMN IF EXISTS email,
      DROP COLUMN IF EXISTS website,
      DROP COLUMN IF EXISTS logo_url,
      DROP COLUMN IF EXISTS timezone,
      DROP COLUMN IF EXISTS session_duration_minutes,
      DROP COLUMN IF EXISTS late_threshold_minutes,
      DROP COLUMN IF EXISTS require_geo_checkin,
      DROP COLUMN IF EXISTS allow_late_checkin
    `);
  }
}