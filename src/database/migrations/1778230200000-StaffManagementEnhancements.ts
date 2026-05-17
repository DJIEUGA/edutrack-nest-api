import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffManagementEnhancements1778230200000 implements MigrationInterface {
  name = 'StaffManagementEnhancements1778230200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Support multi-department invitations (e.g. HoD inviting a lecturer across departments)
    await queryRunner.query(`
      ALTER TABLE staff_invitations
        ADD COLUMN IF NOT EXISTS department_ids uuid[] NOT NULL DEFAULT '{}'
    `);

    // Back-fill: copy the existing single department_id into the new array column
    await queryRunner.query(`
      UPDATE staff_invitations
      SET department_ids = ARRAY[department_id]
      WHERE department_id IS NOT NULL AND department_ids = '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE staff_invitations DROP COLUMN IF EXISTS department_ids
    `);
  }
}
