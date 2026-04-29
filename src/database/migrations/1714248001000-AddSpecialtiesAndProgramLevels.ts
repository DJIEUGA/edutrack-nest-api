import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpecialtiesAndProgramLevels1714248001000 implements MigrationInterface {
  name = 'AddSpecialtiesAndProgramLevels1714248001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table specialties (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        program_id uuid not null references programs(id) on delete cascade,
        code text not null,
        name text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, code)
      )
    `);

    await queryRunner.query(`
      create table program_levels (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        program_id uuid not null references programs(id) on delete cascade,
        level integer not null check (level > 0),
        name text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (program_id, level)
      )
    `);

    await queryRunner.query(`
      alter table classes
      add column specialty_id uuid references specialties(id) on delete set null
    `);

    await queryRunner.query(`create index idx_specialties_program on specialties(program_id)`);
    await queryRunner.query(`create index idx_specialties_school on specialties(school_id)`);
    await queryRunner.query(`create index idx_program_levels_program on program_levels(program_id)`);

    await queryRunner.query(`
      create trigger trg_specialties_updated_at
      before update on specialties
      for each row execute function set_updated_at()
    `);
    await queryRunner.query(`
      create trigger trg_program_levels_updated_at
      before update on program_levels
      for each row execute function set_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table classes drop column if exists specialty_id`);
    await queryRunner.query(`drop table if exists program_levels cascade`);
    await queryRunner.query(`drop table if exists specialties cascade`);
  }
}
