/**
 * Creates (or promotes) a system super-admin user.
 * Idempotent: if the email already exists, it just sets is_system_admin = true.
 *
 * Run after migrations:
 *   pnpm seed:super-admin
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import AppDataSource from '../data-source';

const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@edutrack.io';
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin2024!';
const FULL_NAME = process.env.SUPER_ADMIN_NAME ?? 'System Administrator';

async function createSuperAdmin(): Promise<void> {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();

  try {
    const [existing] = await qr.query(
      'SELECT id, is_system_admin as "isSystemAdmin" FROM users WHERE email = $1',
      [EMAIL],
    );

    if (existing) {
      if (existing.isSystemAdmin) {
        console.log(`Super-admin already exists and is active: ${EMAIL}`);
      } else {
        await qr.query(
          'UPDATE users SET is_system_admin = true, updated_at = NOW() WHERE id = $1',
          [existing.id],
        );
        console.log(`Promoted existing user to super-admin: ${EMAIL}`);
      }
      return;
    }

    await qr.startTransaction();

    const hash = await bcrypt.hash(PASSWORD, 10);
    const [user] = await qr.query(
      `INSERT INTO users (email, password_hash, is_active, is_system_admin)
       VALUES ($1, $2, true, true)
       RETURNING id`,
      [EMAIL, hash],
    );

    await qr.query(
      'INSERT INTO profiles (id, full_name) VALUES ($1, $2)',
      [user.id, FULL_NAME],
    );

    await qr.commitTransaction();

    console.log('');
    console.log('Super-admin created successfully!');
    console.log('');
    console.log(`  Email    : ${EMAIL}`);
    console.log(`  Password : ${PASSWORD}`);
    console.log(`  Name     : ${FULL_NAME}`);
    console.log('');
    console.log('Change this password immediately after first login.');
    console.log('');
  } catch (err) {
    await qr.rollbackTransaction().catch(() => null);
    throw err;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

createSuperAdmin().catch((err) => {
  console.error('Failed to create super-admin:', err);
  process.exit(1);
});
