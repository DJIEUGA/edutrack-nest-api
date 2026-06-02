import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVenueEntitySupport1778230400000 implements MigrationInterface {
  name = 'AddVenueEntitySupport1778230400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // venues.updated_at — referenced in VenuesRepository.update() but missing from original schema
    await queryRunner.query(`
      ALTER TABLE venues
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);

    // timetable_slots.academic_year_id — referenced in TimetableRepository INSERT/SELECT
    await queryRunner.query(`
      ALTER TABLE timetable_slots
        ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL
    `);

    // timetable_slots.updated_at — referenced in TimetableRepository.update()
    await queryRunner.query(`
      ALTER TABLE timetable_slots
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE timetable_slots DROP COLUMN IF EXISTS updated_at`);
    await queryRunner.query(`ALTER TABLE timetable_slots DROP COLUMN IF EXISTS academic_year_id`);
    await queryRunner.query(`ALTER TABLE venues DROP COLUMN IF EXISTS updated_at`);
  }
}
