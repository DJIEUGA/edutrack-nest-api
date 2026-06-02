/**
 * Venue seed — IUT Yaoundé development fixtures.
 *
 * Prerequisites: `pnpm seed` must have been run first (school IUT-YDE-01 must exist).
 * Idempotent: skips if venues already exist for the school.
 *
 * Run:
 *   pnpm seed:venues
 *
 * What it creates:
 *   • 20 venues  (4 amphitheatres, 8 classrooms, 5 computer labs, 3 specialised rooms)
 *   •  9 courses (MAT102 … SEC201) added to the GI department
 *   • 11 course assignments split across L1 / L2 with the two seed lecturers
 *   • 32 timetable slots spread across Mon–Sat for both classes
 *     (venue-conflict-free; lecturer double-booking is expected given the
 *     limited two-lecturer demo set — not enforced at DB level)
 */
import 'reflect-metadata';
import AppDataSource from '../data-source';

// ── Venue catalogue ──────────────────────────────────────────────────────────
const VENUES = [
  // Amphitheatres
  'Amphi A',
  'Amphi B',
  'Amphi C',
  'Amphi D',
  // Classrooms
  'Salle 101',
  'Salle 102',
  'Salle 103',
  'Salle 104',
  'Salle 201',
  'Salle 202',
  'Salle 203',
  'Salle 204',
  // Computer Labs
  'Labo Informatique 1',
  'Labo Informatique 2',
  'Labo Informatique 3',
  'Labo Réseaux et Télécoms',
  'Labo Développement Web',
  // Specialised rooms
  'Salle TP Électronique',
  'Salle TP Systèmes Embarqués',
  'Salle de Conférence',
] as const;

// ── Course catalogue (additional to INFO101 already seeded) ──────────────────
const EXTRA_COURSES = [
  { code: 'MAT102', title: 'Mathématiques et Statistiques',             unitLoad: 4 },
  { code: 'PHY101', title: 'Physique Appliquée',                        unitLoad: 3 },
  { code: 'NET201', title: 'Réseaux et Protocoles',                     unitLoad: 4 },
  { code: 'ALG102', title: 'Algorithmique et Structures de Données',    unitLoad: 5 },
  { code: 'DB201',  title: 'Bases de Données Relationnelles',           unitLoad: 4 },
  { code: 'WEB301', title: 'Développement Web et Frameworks',           unitLoad: 4 },
  { code: 'OS201',  title: "Systèmes d'Exploitation",                   unitLoad: 3 },
  { code: 'SE301',  title: 'Génie Logiciel et Méthodes Agiles',         unitLoad: 4 },
  { code: 'SEC201', title: 'Sécurité Informatique',                     unitLoad: 3 },
] as const;

// ── Timetable definition ──────────────────────────────────────────────────────
// day_of_week: 1 = Monday … 6 = Saturday
// Times are 'HH:MM' strings matching timetable_slots schema
// Venue names must exactly match an entry in VENUES above
type SlotDef = {
  courseCode: string;
  classKey: 'L1' | 'L2';
  day: number;
  start: string;
  end: string;
  venue: string;
};

const SLOT_DEFS: SlotDef[] = [
  // ── L1 — Monday ──────────────────────────────────────────────────────────
  { courseCode: 'INFO101', classKey: 'L1', day: 1, start: '07:30', end: '09:30', venue: 'Amphi A' },
  { courseCode: 'MAT102',  classKey: 'L1', day: 1, start: '09:30', end: '11:30', venue: 'Salle 101' },
  { courseCode: 'ALG102',  classKey: 'L1', day: 1, start: '14:00', end: '16:00', venue: 'Labo Informatique 1' },
  // ── L1 — Tuesday ─────────────────────────────────────────────────────────
  { courseCode: 'PHY101',  classKey: 'L1', day: 2, start: '07:30', end: '09:30', venue: 'Salle 102' },
  { courseCode: 'NET201',  classKey: 'L1', day: 2, start: '09:30', end: '11:30', venue: 'Labo Réseaux et Télécoms' },
  { courseCode: 'MAT102',  classKey: 'L1', day: 2, start: '14:00', end: '16:00', venue: 'Salle 101' },
  // ── L1 — Wednesday ───────────────────────────────────────────────────────
  { courseCode: 'INFO101', classKey: 'L1', day: 3, start: '07:30', end: '09:30', venue: 'Labo Informatique 2' },
  { courseCode: 'DB201',   classKey: 'L1', day: 3, start: '09:30', end: '11:30', venue: 'Labo Informatique 1' },
  { courseCode: 'ALG102',  classKey: 'L1', day: 3, start: '14:00', end: '16:00', venue: 'Salle 103' },
  // ── L1 — Thursday ────────────────────────────────────────────────────────
  { courseCode: 'NET201',  classKey: 'L1', day: 4, start: '07:30', end: '09:30', venue: 'Amphi B' },
  { courseCode: 'PHY101',  classKey: 'L1', day: 4, start: '11:30', end: '13:30', venue: 'Salle TP Électronique' },
  { courseCode: 'DB201',   classKey: 'L1', day: 4, start: '14:00', end: '16:00', venue: 'Labo Informatique 3' },
  // ── L1 — Friday ──────────────────────────────────────────────────────────
  { courseCode: 'INFO101', classKey: 'L1', day: 5, start: '09:30', end: '11:30', venue: 'Labo Informatique 1' },
  { courseCode: 'MAT102',  classKey: 'L1', day: 5, start: '14:00', end: '16:00', venue: 'Salle 104' },
  // ── L1 — Saturday ────────────────────────────────────────────────────────
  { courseCode: 'ALG102',  classKey: 'L1', day: 6, start: '07:30', end: '09:30', venue: 'Amphi C' },
  { courseCode: 'NET201',  classKey: 'L1', day: 6, start: '09:30', end: '11:30', venue: 'Salle 201' },

  // ── L2 — Monday ──────────────────────────────────────────────────────────
  { courseCode: 'SE301',   classKey: 'L2', day: 1, start: '07:30', end: '09:30', venue: 'Amphi D' },
  { courseCode: 'WEB301',  classKey: 'L2', day: 1, start: '09:30', end: '11:30', venue: 'Labo Développement Web' },
  { courseCode: 'OS201',   classKey: 'L2', day: 1, start: '14:00', end: '16:00', venue: 'Salle 202' },
  // ── L2 — Tuesday ─────────────────────────────────────────────────────────
  { courseCode: 'DB201',   classKey: 'L2', day: 2, start: '07:30', end: '09:30', venue: 'Labo Informatique 2' },
  { courseCode: 'SEC201',  classKey: 'L2', day: 2, start: '09:30', end: '11:30', venue: 'Amphi D' },
  { courseCode: 'NET201',  classKey: 'L2', day: 2, start: '14:00', end: '16:00', venue: 'Labo Réseaux et Télécoms' },
  // ── L2 — Wednesday ───────────────────────────────────────────────────────
  { courseCode: 'WEB301',  classKey: 'L2', day: 3, start: '07:30', end: '09:30', venue: 'Labo Développement Web' },
  { courseCode: 'SE301',   classKey: 'L2', day: 3, start: '11:30', end: '13:30', venue: 'Salle 203' },
  { courseCode: 'OS201',   classKey: 'L2', day: 3, start: '14:00', end: '16:00', venue: 'Salle TP Systèmes Embarqués' },
  // ── L2 — Thursday ────────────────────────────────────────────────────────
  { courseCode: 'DB201',   classKey: 'L2', day: 4, start: '09:30', end: '11:30', venue: 'Labo Informatique 3' },
  { courseCode: 'SEC201',  classKey: 'L2', day: 4, start: '14:00', end: '16:00', venue: 'Salle 204' },
  // ── L2 — Friday ──────────────────────────────────────────────────────────
  { courseCode: 'NET201',  classKey: 'L2', day: 5, start: '07:30', end: '09:30', venue: 'Labo Réseaux et Télécoms' },
  { courseCode: 'SE301',   classKey: 'L2', day: 5, start: '09:30', end: '11:30', venue: 'Salle de Conférence' },
  { courseCode: 'WEB301',  classKey: 'L2', day: 5, start: '14:00', end: '16:00', venue: 'Labo Développement Web' },
  // ── L2 — Saturday ────────────────────────────────────────────────────────
  { courseCode: 'OS201',   classKey: 'L2', day: 6, start: '07:30', end: '09:30', venue: 'Salle 201' },
  { courseCode: 'SEC201',  classKey: 'L2', day: 6, start: '09:30', end: '11:30', venue: 'Salle 203' },
];

async function seedVenues(): Promise<void> {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();

  // ── Idempotency guard ─────────────────────────────────────────────────────
  const [{ count }] = await qr.query(`
    SELECT COUNT(v.id)::int AS count
    FROM venues v
    JOIN schools s ON v.school_id = s.id
    WHERE s.code = 'IUT-YDE-01'
  `);
  if (count > 0) {
    console.log(`Venues already seeded (${count} found for IUT-YDE-01) — skipping.`);
    await qr.release();
    await AppDataSource.destroy();
    return;
  }

  // ── Prerequisite lookups (outside transaction — read-only) ────────────────
  const [school] = await qr.query(
    `SELECT id FROM schools WHERE code = 'IUT-YDE-01'`,
  );
  if (!school) throw new Error('School IUT-YDE-01 not found. Run `pnpm seed` first.');
  const schoolId = school.id;

  const [acYear] = await qr.query(
    `SELECT id FROM academic_years WHERE school_id = $1 AND name = '2024-2025'`,
    [schoolId],
  );
  if (!acYear) throw new Error('Academic year 2024-2025 not found. Run `pnpm seed` first.');
  const academicYearId = acYear.id;

  const [classL1] = await qr.query(
    `SELECT id FROM classes WHERE school_id = $1 AND name = 'BTS-GI/DEV-LOG — L1'`,
    [schoolId],
  );
  const [classL2] = await qr.query(
    `SELECT id FROM classes WHERE school_id = $1 AND name = 'BTS-GI/DEV-LOG — L2'`,
    [schoolId],
  );
  if (!classL1 || !classL2) throw new Error('Classes L1/L2 not found. Run `pnpm seed` first.');

  const [deptGI] = await qr.query(
    `SELECT id FROM departments WHERE school_id = $1 AND code = 'GI'`,
    [schoolId],
  );
  if (!deptGI) throw new Error('Department GI not found. Run `pnpm seed` first.');

  const [lec1] = await qr.query(
    `SELECT id FROM users WHERE email = 'e.biya@iut-yde.cm'`,
  );
  const [lec2] = await qr.query(
    `SELECT id FROM users WHERE email = 'm.ngono@iut-yde.cm'`,
  );
  if (!lec1 || !lec2) throw new Error('Lecturer accounts not found. Run `pnpm seed` first.');

  const classIdMap: Record<'L1' | 'L2', string> = {
    L1: classL1.id,
    L2: classL2.id,
  };

  let txStarted = false;
  try {
    await qr.startTransaction();
    txStarted = true;

    // ── 1. Venues ─────────────────────────────────────────────────────────
    for (const name of VENUES) {
      await qr.query(
        `INSERT INTO venues (school_id, name, latitude, longitude)
         VALUES ($1, $2, NULL, NULL)`,
        [schoolId, name],
      );
    }

    // ── 2. Courses ────────────────────────────────────────────────────────
    const courseIdMap: Record<string, string> = {};

    for (const c of EXTRA_COURSES) {
      const existing = await qr.query(
        `SELECT id FROM courses WHERE school_id = $1 AND code = $2`,
        [schoolId, c.code],
      );
      if (existing.length > 0) {
        courseIdMap[c.code] = existing[0].id;
      } else {
        const [row] = await qr.query(
          `INSERT INTO courses (school_id, department_id, code, title, unit_load)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [schoolId, deptGI.id, c.code, c.title, c.unitLoad],
        );
        courseIdMap[c.code] = row.id;
      }
    }

    // Pick up the existing INFO101 course
    const [info101] = await qr.query(
      `SELECT id FROM courses WHERE school_id = $1 AND code = 'INFO101'`,
      [schoolId],
    );
    if (info101) courseIdMap['INFO101'] = info101.id;

    // ── 3. Course assignments ─────────────────────────────────────────────
    // lec1 → L1: INFO101, MAT102, NET201, DB201  |  L2: WEB301, SE301
    // lec2 → L1: PHY101, ALG102                 |  L2: OS201, SEC201, NET201, DB201
    type AssignDef = { code: string; classKey: 'L1' | 'L2'; lecId: string };
    const ASSIGNMENT_DEFS: AssignDef[] = [
      { code: 'MAT102', classKey: 'L1', lecId: lec1.id },
      { code: 'PHY101', classKey: 'L1', lecId: lec2.id },
      { code: 'NET201', classKey: 'L1', lecId: lec1.id },
      { code: 'ALG102', classKey: 'L1', lecId: lec2.id },
      { code: 'DB201',  classKey: 'L1', lecId: lec1.id },
      { code: 'WEB301', classKey: 'L2', lecId: lec1.id },
      { code: 'OS201',  classKey: 'L2', lecId: lec2.id },
      { code: 'SE301',  classKey: 'L2', lecId: lec1.id },
      { code: 'SEC201', classKey: 'L2', lecId: lec2.id },
      { code: 'NET201', classKey: 'L2', lecId: lec2.id },
      { code: 'DB201',  classKey: 'L2', lecId: lec2.id },
    ];

    // assignment key → assignment UUID
    const assignIdMap: Record<string, string> = {};

    for (const a of ASSIGNMENT_DEFS) {
      const courseId = courseIdMap[a.code];
      if (!courseId) continue;
      const classId = classIdMap[a.classKey];
      const existing = await qr.query(
        `SELECT id FROM course_assignments
         WHERE academic_year_id = $1 AND course_id = $2 AND class_id = $3 AND lecturer_user_id = $4`,
        [academicYearId, courseId, classId, a.lecId],
      );
      if (existing.length > 0) {
        assignIdMap[`${a.code}_${a.classKey}`] = existing[0].id;
      } else {
        const [row] = await qr.query(
          `INSERT INTO course_assignments
             (school_id, course_id, class_id, lecturer_user_id, academic_year_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [schoolId, courseId, classId, a.lecId, academicYearId],
        );
        assignIdMap[`${a.code}_${a.classKey}`] = row.id;
      }
    }

    // Bring in the existing INFO101 / L1 assignment created by seed.ts
    const [existingInfo101] = await qr.query(
      `SELECT ca.id
       FROM course_assignments ca
       JOIN courses c ON ca.course_id = c.id
       WHERE ca.school_id = $1 AND c.code = 'INFO101' AND ca.class_id = $2`,
      [schoolId, classIdMap['L1']],
    );
    if (existingInfo101) assignIdMap['INFO101_L1'] = existingInfo101.id;

    // ── 4. Timetable slots ────────────────────────────────────────────────
    let slotsCreated = 0;
    for (const slot of SLOT_DEFS) {
      const assignId = assignIdMap[`${slot.courseCode}_${slot.classKey}`];
      if (!assignId) continue;

      await qr.query(
        `INSERT INTO timetable_slots
           (school_id, academic_year_id, course_assignment_id, day_of_week, start_time, end_time, venue)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [schoolId, academicYearId, assignId, slot.day, slot.start, slot.end, slot.venue],
      );
      slotsCreated++;
    }

    await qr.commitTransaction();

    // ── Summary ───────────────────────────────────────────────────────────
    const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    console.log('');
    console.log('✅  Venue seed completed!');
    console.log('');
    console.log(`  School       : IUT Yaoundé — Antenne de Ngoa-Ekélé`);
    console.log(`  Venues       : ${VENUES.length}`);
    console.log(`  Courses added: ${EXTRA_COURSES.length}`);
    console.log(`  Assignments  : ${Object.keys(assignIdMap).length}`);
    console.log(`  Timetable    : ${slotsCreated} slots (Mon – Sat)`);
    console.log('');
    console.log('  Venues:');
    console.log('  ┌─────────────────────────────────────────────┬──────────────────┐');
    console.log('  │ Name                                        │ Type             │');
    console.log('  ├─────────────────────────────────────────────┼──────────────────┤');
    for (const v of VENUES) {
      const type =
        v.startsWith('Amphi')   ? 'Amphithéâtre' :
        v.startsWith('Salle 1') ||
        v.startsWith('Salle 2') ? 'Salle de cours' :
        v.startsWith('Labo')    ? 'Laboratoire'   :
                                  'Salle spécialisée';
      console.log(`  │ ${v.padEnd(43)} │ ${type.padEnd(16)} │`);
    }
    console.log('  └─────────────────────────────────────────────┴──────────────────┘');
    console.log('');
    console.log('  Sample timetable (L1 — first 4 days):');
    for (const s of SLOT_DEFS.filter((s) => s.classKey === 'L1' && s.day <= 4)) {
      console.log(`    ${DAY[s.day]} ${s.start}-${s.end}  ${s.courseCode.padEnd(7)} → ${s.venue}`);
    }
    console.log('');
  } catch (err) {
    if (txStarted) await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seedVenues().catch((err) => {
  console.error('Venue seed failed:', err);
  process.exit(1);
});
