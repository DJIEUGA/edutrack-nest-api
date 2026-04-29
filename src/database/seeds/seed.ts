/**
 * Seed script — Cameroon university context.
 *
 * Idempotent: skips if the organisation "IUT-YDE" already exists.
 *
 * Run after migrations:
 *   pnpm seed
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import AppDataSource from '../data-source';

const DEFAULT_PASSWORD = 'EduTrack2024!';
const SALT_ROUNDS = 10;

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();

  // Idempotency guard — runs outside the transaction so rollback isn't attempted on failure
  const existing = await qr.query(`select id from organizations where code = 'IUT-YDE' limit 1`);
  if (existing.length > 0) {
    console.log('Seed data already present — skipping.');
    await qr.release();
    await AppDataSource.destroy();
    return;
  }

  let txStarted = false;
  try {
    await qr.startTransaction();
    txStarted = true;

    // ── 1. Hash shared password ───────────────────────────────────────────────
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // ── 2. Users ──────────────────────────────────────────────────────────────
    const userDefs = [
      { email: 'jb.nkolo@iut-yde.cm', fullName: 'Jean-Baptiste Nkolo Mba', phone: '+237677000001' },
      { email: 'mc.tchameni@iut-yde.cm', fullName: 'Marie-Claire Tchameni', phone: '+237677000002' },
      { email: 'p.abanda@iut-yde.cm', fullName: 'Paul Abanda Mvogo', phone: '+237677000003' },
      { email: 'c.mfula@iut-yde.cm', fullName: 'Dr. Christelle Mfula Biwole', phone: '+237677000004' },
      { email: 'e.biya@iut-yde.cm', fullName: 'Emmanuel Biya Essomba', phone: '+237677000005' },
      { email: 'm.ngono@iut-yde.cm', fullName: 'Martine Ngono Ateba', phone: '+237677000006' },
      { email: 'k.essomba@iut-yde.cm', fullName: 'Kevin Essomba Ndongo', phone: '+237677000007' },
      { email: 'g.mbarga@iut-yde.cm', fullName: 'Grace Mbarga Onana', phone: '+237677000008' },
      { email: 'r.ateba@iut-yde.cm', fullName: 'Robert Ateba Owona', phone: '+237677000009' },
      { email: 's.fouda@iut-yde.cm', fullName: 'Sophie Fouda Belinga', phone: '+237677000010' },
    ];

    const userIds: Record<string, string> = {};
    for (const u of userDefs) {
      const [row] = await qr.query(
        `insert into users (email, password_hash, is_active) values ($1, $2, true) returning id`,
        [u.email, hash],
      );
      userIds[u.email] = row.id;
      await qr.query(
        `insert into profiles (id, full_name, phone) values ($1, $2, $3)`,
        [row.id, u.fullName, u.phone],
      );
    }

    const [owner, admin, director, hod, lec1, lec2, stu1, stu2, guardian, follower] =
      userDefs.map((u) => userIds[u.email]);

    // ── 3. Organisation ───────────────────────────────────────────────────────
    const [org] = await qr.query(
      `insert into organizations (name, code, created_by) values ($1, $2, $3) returning id`,
      ["Institut Universitaire de Technologie de Yaoundé", 'IUT-YDE', owner],
    );
    const orgId: string = org.id;

    // Organisation memberships
    const orgMembers: Array<[string, string]> = [
      [owner, 'owner'],
      [admin, 'member'],
      [director, 'member'],
      [hod, 'member'],
      [lec1, 'member'],
      [lec2, 'member'],
      [stu1, 'member'],
      [stu2, 'member'],
      [guardian, 'member'],
      [follower, 'follower'],
    ];
    for (const [uid, role] of orgMembers) {
      await qr.query(
        `insert into organization_memberships (organization_id, user_id, role) values ($1, $2, $3)`,
        [orgId, uid, role],
      );
    }

    // ── 4. School ─────────────────────────────────────────────────────────────
    const [school] = await qr.query(
      `insert into schools (organization_id, name, code, status) values ($1, $2, $3, 'active') returning id`,
      [orgId, 'IUT Yaoundé — Antenne de Ngoa-Ekélé', 'IUT-YDE-01'],
    );
    const schoolId: string = school.id;

    // School memberships (all users except follower)
    const schoolMembers = [owner, admin, director, hod, lec1, lec2, stu1, stu2, guardian, follower];
    for (const uid of schoolMembers) {
      await qr.query(
        `insert into school_memberships (school_id, user_id) values ($1, $2)`,
        [schoolId, uid],
      );
    }

    // ── 5. Departments ────────────────────────────────────────────────────────
    const [deptGI] = await qr.query(
      `insert into departments (school_id, code, name) values ($1, $2, $3) returning id`,
      [schoolId, 'GI', 'Génie Informatique'],
    );
    const [deptGC] = await qr.query(
      `insert into departments (school_id, code, name) values ($1, $2, $3) returning id`,
      [schoolId, 'GC', 'Génie Civil et Mines'],
    );
    const deptGIId: string = deptGI.id;
    const deptGCId: string = deptGC.id;

    // ── 6. User role assignments ──────────────────────────────────────────────
    const roleAssignments: Array<[string, string, string | null]> = [
      [owner, 'owner', null],
      [admin, 'admin', null],
      [director, 'director', null],
      [hod, 'hod', deptGIId],
      [lec1, 'lecturer', deptGIId],
      [lec2, 'lecturer', deptGIId],
      [stu1, 'student', null],
      [stu2, 'student', null],
      [guardian, 'guardian', null],
      [follower, 'follower', null],
    ];
    for (const [uid, role, deptId] of roleAssignments) {
      await qr.query(
        `insert into user_roles (user_id, school_id, role, department_id) values ($1, $2, $3, $4)`,
        [uid, schoolId, role, deptId],
      );
    }

    // ── 7. Programs ───────────────────────────────────────────────────────────
    const [progBTS] = await qr.query(
      `insert into programs (school_id, department_id, code, name, duration_years)
       values ($1, $2, $3, $4, $5) returning id`,
      [schoolId, deptGIId, 'BTS-GI', 'BTS Génie Informatique', 2],
    );
    const [progLic] = await qr.query(
      `insert into programs (school_id, department_id, code, name, duration_years)
       values ($1, $2, $3, $4, $5) returning id`,
      [schoolId, deptGIId, 'LIC-INFO', 'Licence Informatique', 3],
    );
    const [progBTSGC] = await qr.query(
      `insert into programs (school_id, department_id, code, name, duration_years)
       values ($1, $2, $3, $4, $5) returning id`,
      [schoolId, deptGCId, 'BTS-GC', 'BTS Génie Civil', 2],
    );
    const btsProgramId: string = progBTS.id;
    const licProgramId: string = progLic.id;
    void progBTSGC; // seeded but not used in classes below

    // ── 8. Specialties ────────────────────────────────────────────────────────
    const [specDevLog] = await qr.query(
      `insert into specialties (school_id, program_id, code, name) values ($1, $2, $3, $4) returning id`,
      [schoolId, btsProgramId, 'DEV-LOG', 'Développement Logiciel'],
    );
    const [specResSec] = await qr.query(
      `insert into specialties (school_id, program_id, code, name) values ($1, $2, $3, $4) returning id`,
      [schoolId, btsProgramId, 'RES-SEC', 'Réseaux et Sécurité Informatique'],
    );
    const [specIA] = await qr.query(
      `insert into specialties (school_id, program_id, code, name) values ($1, $2, $3, $4) returning id`,
      [schoolId, licProgramId, 'IA', 'Intelligence Artificielle et Données'],
    );
    const devLogId: string = specDevLog.id;
    void specResSec;
    void specIA;

    // ── 9. Program levels ─────────────────────────────────────────────────────
    // BTS Génie Informatique: 2 years
    await qr.query(
      `insert into program_levels (school_id, program_id, level, name) values ($1, $2, $3, $4)`,
      [schoolId, btsProgramId, 1, 'Niveau 1 — Première Année'],
    );
    await qr.query(
      `insert into program_levels (school_id, program_id, level, name) values ($1, $2, $3, $4)`,
      [schoolId, btsProgramId, 2, 'Niveau 2 — Deuxième Année'],
    );

    // Licence Informatique: 3 years
    for (const [lvl, label] of [
      [1, 'Licence 1 — Première Année'],
      [2, 'Licence 2 — Deuxième Année'],
      [3, 'Licence 3 — Troisième Année'],
    ] as const) {
      await qr.query(
        `insert into program_levels (school_id, program_id, level, name) values ($1, $2, $3, $4)`,
        [schoolId, licProgramId, lvl, label],
      );
    }

    // BTS Génie Civil: 2 years
    await qr.query(
      `insert into program_levels (school_id, program_id, level, name) values ($1, $2, $3, $4)`,
      [schoolId, progBTSGC.id, 1, 'Niveau 1 — Première Année'],
    );
    await qr.query(
      `insert into program_levels (school_id, program_id, level, name) values ($1, $2, $3, $4)`,
      [schoolId, progBTSGC.id, 2, 'Niveau 2 — Deuxième Année'],
    );

    // ── 10. Academic year ─────────────────────────────────────────────────────
    const [acYear] = await qr.query(
      `insert into academic_years (school_id, name, start_date, end_date, is_active)
       values ($1, $2, $3, $4, true) returning id`,
      [schoolId, '2024-2025', '2024-09-01', '2025-07-31'],
    );
    const academicYearId: string = acYear.id;

    // ── 11. Semesters ─────────────────────────────────────────────────────────
    await qr.query(
      `insert into semesters (academic_year_id, name, start_date, end_date, is_current)
       values ($1, $2, $3, $4, true)`,
      [academicYearId, 'Semestre 1', '2024-09-01', '2025-01-31'],
    );
    await qr.query(
      `insert into semesters (academic_year_id, name, start_date, end_date, is_current)
       values ($1, $2, $3, $4, false)`,
      [academicYearId, 'Semestre 2', '2025-02-01', '2025-07-31'],
    );

    // ── 12. Classes ───────────────────────────────────────────────────────────
    const [classL1] = await qr.query(
      `insert into classes (school_id, academic_year_id, program_id, specialty_id, name, level)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [schoolId, academicYearId, btsProgramId, devLogId, 'BTS-GI/DEV-LOG — L1', 1],
    );
    const [classL2] = await qr.query(
      `insert into classes (school_id, academic_year_id, program_id, specialty_id, name, level)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [schoolId, academicYearId, btsProgramId, devLogId, 'BTS-GI/DEV-LOG — L2', 2],
    );

    // ── 13. Students ──────────────────────────────────────────────────────────
    await qr.query(
      `insert into students (school_id, user_id, matric_no, class_id) values ($1, $2, $3, $4)`,
      [schoolId, stu1, 'IUT-GI-2024-001', classL1.id],
    );
    await qr.query(
      `insert into students (school_id, user_id, matric_no, class_id) values ($1, $2, $3, $4)`,
      [schoolId, stu2, 'IUT-GI-2023-042', classL2.id],
    );

    // ── 14. Course & assignment for demonstration ──────────────────────────────
    const [course] = await qr.query(
      `insert into courses (school_id, department_id, code, title, unit_load) values ($1, $2, $3, $4, $5) returning id`,
      [schoolId, deptGIId, 'INFO101', 'Introduction à la Programmation', 4],
    );
    const [assign] = await qr.query(
      `insert into course_assignments (school_id, course_id, class_id, lecturer_user_id, academic_year_id)
       values ($1, $2, $3, $4, $5) returning id`,
      [schoolId, course.id, classL1.id, lec1, academicYearId],
    );
    void assign;

    await qr.commitTransaction();

    console.log('');
    console.log('✅  Seed completed successfully!');
    console.log('');
    console.log('  Organisation : Institut Universitaire de Technologie de Yaoundé (IUT-YDE)');
    console.log('  School       : IUT Yaoundé — Antenne de Ngoa-Ekélé');
    console.log('  Academic year: 2024-2025');
    console.log('');
    console.log('  Seeded users (password for all: EduTrack2024!)');
    console.log('  ┌─────────────────────────────────────┬───────────┐');
    console.log('  │ Email                               │ Role      │');
    console.log('  ├─────────────────────────────────────┼───────────┤');
    console.log('  │ jb.nkolo@iut-yde.cm                 │ owner     │');
    console.log('  │ mc.tchameni@iut-yde.cm              │ admin     │');
    console.log('  │ p.abanda@iut-yde.cm                 │ director  │');
    console.log('  │ c.mfula@iut-yde.cm                  │ hod       │');
    console.log('  │ e.biya@iut-yde.cm                   │ lecturer  │');
    console.log('  │ m.ngono@iut-yde.cm                  │ lecturer  │');
    console.log('  │ k.essomba@iut-yde.cm                │ student   │');
    console.log('  │ g.mbarga@iut-yde.cm                 │ student   │');
    console.log('  │ r.ateba@iut-yde.cm                  │ guardian  │');
    console.log('  │ s.fouda@iut-yde.cm                  │ follower  │');
    console.log('  └─────────────────────────────────────┴───────────┘');
    console.log('');
  } catch (err) {
    if (txStarted) await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
