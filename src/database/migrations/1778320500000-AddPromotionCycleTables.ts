import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionCycleTables1778320500000 implements MigrationInterface {
  name = 'AddPromotionCycleTables1778320500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // sessions.status is typed as a PostgreSQL enum 'session_status'.
    // Convert it to TEXT so we can add 'pending_confirmation' without an enum DDL change,
    // which cannot be executed inside a transaction on PostgreSQL < 12.
    await queryRunner.query(`ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_session_status`);
    await queryRunner.query(`ALTER TABLE sessions ALTER COLUMN status TYPE TEXT`);
    await queryRunner.query(`
      ALTER TABLE sessions ADD CONSTRAINT chk_session_status
        CHECK (status IN ('pending_confirmation', 'scheduled', 'live', 'completed', 'cancelled'))
    `);

    await queryRunner.query(`
      CREATE TYPE promotion_cycle_status_enum AS ENUM ('active', 'completed', 'expired')
    `);

    await queryRunner.query(`
      CREATE TYPE slot_promotion_status_enum AS ENUM ('pending', 'confirmed', 'modified', 'reset')
    `);

    await queryRunner.query(`
      CREATE TABLE promotion_cycles (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        week_start    DATE NOT NULL,
        week_end      DATE NOT NULL,
        triggered_by  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        triggered_at  TIMESTAMPTZ NOT NULL,
        status        promotion_cycle_status_enum NOT NULL DEFAULT 'active',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_promotion_cycles_school_week UNIQUE (school_id, week_start)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE slot_promotions (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_cycle_id  UUID NOT NULL REFERENCES promotion_cycles(id) ON DELETE CASCADE,
        timetable_slot_id   UUID NOT NULL,
        lecturer_user_id    UUID NOT NULL,
        school_id           UUID NOT NULL,
        status              slot_promotion_status_enum NOT NULL DEFAULT 'pending',
        confirmed_at        TIMESTAMPTZ,
        reset_at            TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_slot_promotions_cycle_slot UNIQUE (promotion_cycle_id, timetable_slot_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_slot_promotions_lecturer_status
        ON slot_promotions (lecturer_user_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_slot_promotions_cycle_status
        ON slot_promotions (promotion_cycle_id, status)
    `);

    await queryRunner.query(`
      CREATE TABLE promotion_reminders (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_cycle_id  UUID NOT NULL REFERENCES promotion_cycles(id) ON DELETE CASCADE,
        lecturer_user_id    UUID NOT NULL,
        school_id           UUID NOT NULL,
        is_read             BOOLEAN NOT NULL DEFAULT FALSE,
        message             TEXT NOT NULL,
        sent_at             TIMESTAMPTZ NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_promotion_reminders_lecturer_read
        ON promotion_reminders (lecturer_user_id, is_read)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_promotion_reminders_lecturer_read`);
    await queryRunner.query(`DROP TABLE IF EXISTS promotion_reminders`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_slot_promotions_cycle_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_slot_promotions_lecturer_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS slot_promotions`);
    await queryRunner.query(`DROP TABLE IF EXISTS promotion_cycles`);
    await queryRunner.query(`DROP TYPE IF EXISTS slot_promotion_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS promotion_cycle_status_enum`);
    // Restore sessions.status to the original enum type and check constraint.
    await queryRunner.query(`ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_session_status`);
    await queryRunner.query(
      `ALTER TABLE sessions ALTER COLUMN status TYPE session_status USING status::session_status`,
    );
    await queryRunner.query(`
      ALTER TABLE sessions ADD CONSTRAINT chk_session_status
        CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled'))
    `);
  }
}
