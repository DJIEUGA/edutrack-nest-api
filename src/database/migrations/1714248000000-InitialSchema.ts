import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema mirroring docs/postgresql-ddl.sql.
 * The DDL is the source of truth; subsequent migrations layer on top.
 */
export class InitialSchema1714248000000 implements MigrationInterface {
  name = 'InitialSchema1714248000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists pgcrypto`);

    // Enums
    await queryRunner.query(
      `create type membership_role as enum ('owner', 'member', 'follower')`,
    );
    await queryRunner.query(
      `create type user_role as enum ('owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian', 'follower')`,
    );
    await queryRunner.query(`create type school_status as enum ('active', 'inactive')`);
    await queryRunner.query(
      `create type invitation_status as enum ('pending', 'processing', 'accepted', 'expired', 'cancelled')`,
    );
    await queryRunner.query(
      `create type session_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `create type attendance_status as enum ('present', 'absent', 'late', 'excused')`,
    );
    await queryRunner.query(
      `create type import_job_status as enum ('created', 'validating', 'ready', 'committing', 'completed', 'failed')`,
    );

    // Identity
    await queryRunner.query(`
      create table users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        password_hash text not null,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    await queryRunner.query(`
      create table profiles (
        id uuid primary key references users(id) on delete cascade,
        full_name text not null,
        phone text,
        avatar_url text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    // Tenant hierarchy
    await queryRunner.query(`
      create table organizations (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        code text not null unique,
        logo_url text,
        created_by uuid not null references users(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    await queryRunner.query(`
      create table organization_memberships (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references organizations(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        role membership_role not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, user_id)
      )
    `);

    await queryRunner.query(`
      create table schools (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references organizations(id) on delete cascade,
        name text not null,
        code text not null,
        status school_status not null default 'active',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, code)
      )
    `);

    await queryRunner.query(`
      create table school_memberships (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, user_id)
      )
    `);

    await queryRunner.query(`
      create table user_roles (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        school_id uuid not null references schools(id) on delete cascade,
        role user_role not null,
        department_id uuid,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (user_id, school_id, role)
      )
    `);

    // Academic setup
    await queryRunner.query(`
      create table academic_years (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        name text not null,
        start_date date not null,
        end_date date not null,
        is_active boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (start_date < end_date)
      )
    `);

    await queryRunner.query(`
      create table semesters (
        id uuid primary key default gen_random_uuid(),
        academic_year_id uuid not null references academic_years(id) on delete cascade,
        name text not null,
        start_date date not null,
        end_date date not null,
        is_current boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (start_date < end_date)
      )
    `);

    await queryRunner.query(`
      create table departments (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        code text not null,
        name text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, code)
      )
    `);

    await queryRunner.query(`
      create table programs (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        department_id uuid references departments(id) on delete set null,
        code text not null,
        name text not null,
        duration_years integer not null check (duration_years > 0),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, code)
      )
    `);

    await queryRunner.query(`
      create table courses (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        department_id uuid references departments(id) on delete set null,
        code text not null,
        title text not null,
        unit_load integer not null default 2 check (unit_load > 0),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, code)
      )
    `);

    await queryRunner.query(`
      create table classes (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        academic_year_id uuid not null references academic_years(id) on delete cascade,
        program_id uuid references programs(id) on delete set null,
        name text not null,
        level integer,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, academic_year_id, name)
      )
    `);

    await queryRunner.query(`
      create table students (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        user_id uuid unique references users(id) on delete set null,
        matric_no text,
        class_id uuid references classes(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, matric_no)
      )
    `);

    await queryRunner.query(`
      create table course_assignments (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        course_id uuid not null references courses(id) on delete cascade,
        class_id uuid not null references classes(id) on delete cascade,
        lecturer_user_id uuid not null references users(id) on delete cascade,
        academic_year_id uuid not null references academic_years(id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (school_id, course_id, class_id, lecturer_user_id, academic_year_id)
      )
    `);

    // Timetable and sessions
    await queryRunner.query(`
      create table timetable_slots (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        academic_year_id uuid not null references academic_years(id) on delete cascade,
        course_assignment_id uuid not null references course_assignments(id) on delete cascade,
        day_of_week smallint not null check (day_of_week between 1 and 7),
        start_time time not null,
        end_time time not null,
        venue text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (start_time < end_time)
      )
    `);

    await queryRunner.query(`
      create table sessions (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        course_assignment_id uuid not null references course_assignments(id) on delete cascade,
        timetable_slot_id uuid references timetable_slots(id) on delete set null,
        scheduled_date date not null,
        status session_status not null default 'scheduled',
        actual_start timestamptz,
        actual_end timestamptz,
        start_lat double precision,
        start_lng double precision,
        start_accuracy double precision,
        started_by uuid references users(id) on delete set null,
        ended_by uuid references users(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    await queryRunner.query(`
      create table attendance_records (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        session_id uuid not null references sessions(id) on delete cascade,
        student_id uuid not null references students(id) on delete cascade,
        status attendance_status not null,
        marked_by uuid references users(id) on delete set null,
        marked_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (session_id, student_id)
      )
    `);

    // Refresh tokens (auth)
    await queryRunner.query(`
      create table refresh_tokens (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        token_hash text not null unique,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        replaced_by uuid references refresh_tokens(id) on delete set null,
        created_at timestamptz not null default now()
      )
    `);
    await queryRunner.query(`create index idx_refresh_tokens_user on refresh_tokens(user_id)`);

    // Invitations
    await queryRunner.query(`
      create table staff_invitations (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        school_id uuid not null references schools(id) on delete cascade,
        role user_role not null,
        department_id uuid references departments(id) on delete set null,
        token text not null unique,
        status invitation_status not null default 'pending',
        invited_by uuid not null references users(id) on delete restrict,
        accepted_at timestamptz,
        expires_at timestamptz not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    // Imports
    await queryRunner.query(`
      create table import_jobs (
        id uuid primary key default gen_random_uuid(),
        school_id uuid not null references schools(id) on delete cascade,
        initiated_by uuid not null references users(id) on delete restrict,
        type text not null,
        status import_job_status not null default 'created',
        source_file_url text,
        summary jsonb,
        errors jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    // Audit
    await queryRunner.query(`
      create table audit_logs (
        id uuid primary key default gen_random_uuid(),
        actor_user_id uuid references users(id) on delete set null,
        scope_organization_id uuid references organizations(id) on delete set null,
        scope_school_id uuid references schools(id) on delete set null,
        action text not null,
        resource_type text not null,
        resource_id uuid,
        metadata jsonb,
        occurred_at timestamptz not null default now()
      )
    `);

    // Indexes
    await queryRunner.query(`create index idx_org_memberships_user on organization_memberships(user_id)`);
    await queryRunner.query(`create index idx_school_memberships_user on school_memberships(user_id)`);
    await queryRunner.query(`create index idx_user_roles_scope on user_roles(user_id, school_id)`);
    await queryRunner.query(`create index idx_academic_years_school on academic_years(school_id)`);
    await queryRunner.query(`create index idx_sessions_school_date on sessions(school_id, scheduled_date)`);
    await queryRunner.query(
      `create index idx_attendance_school_session on attendance_records(school_id, session_id)`,
    );
    await queryRunner.query(`create index idx_import_jobs_school_status on import_jobs(school_id, status)`);
    await queryRunner.query(
      `create index idx_audit_scope_time on audit_logs(scope_school_id, occurred_at desc)`,
    );
    await queryRunner.query(
      `create index idx_staff_invites_pending on staff_invitations(school_id, expires_at) where status = 'pending'`,
    );
    await queryRunner.query(
      `create index idx_timetable_slots_assignment on timetable_slots(course_assignment_id)`,
    );
    await queryRunner.query(
      `create index idx_sessions_assignment on sessions(course_assignment_id, scheduled_date)`,
    );

    // Update timestamp helper
    await queryRunner.query(`
      create or replace function set_updated_at()
      returns trigger as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$ language plpgsql
    `);

    // Triggers
    const tablesWithUpdatedAt = [
      'users',
      'profiles',
      'organizations',
      'organization_memberships',
      'schools',
      'school_memberships',
      'user_roles',
      'academic_years',
      'semesters',
      'departments',
      'programs',
      'courses',
      'classes',
      'students',
      'course_assignments',
      'timetable_slots',
      'sessions',
      'attendance_records',
      'staff_invitations',
      'import_jobs',
    ];
    for (const t of tablesWithUpdatedAt) {
      await queryRunner.query(
        `create trigger trg_${t}_updated_at before update on ${t} for each row execute function set_updated_at()`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'audit_logs',
      'import_jobs',
      'staff_invitations',
      'refresh_tokens',
      'attendance_records',
      'sessions',
      'timetable_slots',
      'course_assignments',
      'students',
      'classes',
      'courses',
      'programs',
      'departments',
      'semesters',
      'academic_years',
      'user_roles',
      'school_memberships',
      'schools',
      'organization_memberships',
      'organizations',
      'profiles',
      'users',
    ];
    for (const t of tables) {
      await queryRunner.query(`drop table if exists ${t} cascade`);
    }
    await queryRunner.query(`drop function if exists set_updated_at() cascade`);
    const enums = [
      'import_job_status',
      'attendance_status',
      'session_status',
      'invitation_status',
      'school_status',
      'user_role',
      'membership_role',
    ];
    for (const e of enums) {
      await queryRunner.query(`drop type if exists ${e}`);
    }
  }
}
