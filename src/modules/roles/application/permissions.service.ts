import { Injectable, Inject } from '@nestjs/common';
import { ConflictError, NotFoundError, DomainError } from '@common/errors/domain.errors';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '@common/types/role.types';
import { ROLE_CAPABILITIES } from '../domain/role-capabilities';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  
  async findAll() {
    return this.dataSource.query('SELECT * FROM permissions ORDER BY code ASC');
  }

  async findAllRoles(schoolId: string) {
    return this.dataSource.query(
      'SELECT * FROM dynamic_roles WHERE school_id = $1 ORDER BY name ASC',
      [schoolId],
    );
  }

  async createRole(schoolId: string, data: { code: string; name: string }) {
    const [result] = await this.dataSource.query(
      `INSERT INTO dynamic_roles (school_id, code, name) 
       VALUES ($1, $2, $3) 
       RETURNING id, code, name`,
      [schoolId, data.code, data.name],
    );
    return result;
  }

  async create(data: { code: string; description?: string }) {
    try {
      const [result] = await this.dataSource.query(
        'INSERT INTO permissions (code, description) VALUES ($1, $2) RETURNING id, code, description',
        [data.code, data.description],
      );
      return result;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictError(`Permission with code ${data.code} already exists`);
      }
      throw error;
    }
  }

  async assignToUser(params: { userId: string; schoolId: string; permissionCode: string }) {
    const [permission] = await this.dataSource.query(
      'SELECT code FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    try {
      await this.dataSource.query(
        `INSERT INTO user_permissions (user_id, school_id, permission_id) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id, school_id, permission_id) DO NOTHING`,
        [params.userId, params.schoolId, permission.code],
      );
      await this.invalidateUserCache(params.userId, params.schoolId);
    } catch (error: any) {
      throw new Error(`Failed to assign permission: ${error.message}`);
    }
    return { success: true };
  }

  async assignPermissionToRole(params: { roleId: string; permissionCode: string }) {
    const [permission] = await this.dataSource.query(
      'SELECT code FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    // Corrected to use the school_id/role/permission_id schema from the infrastructure migration
    await this.dataSource.query(
      `INSERT INTO role_permissions (school_id, role, permission_id) 
       SELECT school_id, code, $2 FROM dynamic_roles WHERE id = $1
       ON CONFLICT (school_id, role, permission_id) DO NOTHING`,
      [params.roleId, permission.code],
    );
    await this.invalidateRoleUsersCache(params.roleId);
  }

  /**
   * Automatically configures a new school with standard dynamic roles and 
   * default permission mappings for all roles.
   */
  async initializeSchoolDefaultPermissions(schoolId: string) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Seed common "Dynamic Roles"
      await manager.query(`
        INSERT INTO "dynamic_roles" (school_id, code, name)
        VALUES 
          ($1, 'exam-officer', 'Exam Officer'),
          ($1, 'bursar', 'Bursar / Accountant'),
          ($1, 'registrar', 'Registrar')
        ON CONFLICT (school_id, code) DO NOTHING;
      `, [schoolId]);

      // 2. Define default permission mappings
      const roleMappings = [
        {
          role: 'admin',
          permissions: [
            'user:read', 'user:create', 'user:update', 'user:delete',
            'school:read', 'school:update',
            'academic-year:read', 'academic-year:create', 'academic-year:update',
            'department:read', 'department:create', 'department:update',
            'course:read', 'course:create', 'course:update',
            'class:read', 'class:create', 'class:update',
            'invitation:read', 'invitation:create', 'invitation:delete',
            'venue:read', 'venue:create', 'venue:update',
            'import:job:read', 'import:job:create',
            'audit:log:read', 'report:attendance:read', 'report:enrollment:read'
          ],
        },
        {
          role: 'lecturer',
          permissions: [
            'session:read', 'session:start', 'session:end',
            'attendance:mark', 'attendance:record:read', 'attendance:record:bulk-create',
            'timetable:slot:read', 'course:read', 'venue:read',
            'result:bulk:create', 'student:attendance:summary:read'
          ],
        },
        {
          role: 'hod',
          permissions: [
            'department:read', 'department:update', 'course:read', 'course:update',
            'program:read', 'program:update', 'timetable:manage', 'timetable:slot:read',
            'session:read', 'attendance:record:read', 'student:attendance:summary:read'
          ],
        },
        {
          role: 'student',
          permissions: [
            'timetable:slot:read', 'session:read', 'attendance:student:read', 
            'result:student:read', 'permission:read:self'
          ],
        },
        {
          role: 'exam-officer',
          permissions: [
            'result:bulk:create', 'result:student:read', 'course:read', 
            'class:read', 'academic-year:read'
          ],
        },
      ];

      for (const mapping of roleMappings) {
        const values = mapping.permissions
          .map((perm) => `('${schoolId}', '${mapping.role}', '${perm}')`)
          .join(',');

        if (values) {
          await manager.query(`
            INSERT INTO "role_permissions" (school_id, role, permission_id)
            VALUES ${values}
            ON CONFLICT (school_id, role, permission_id) DO NOTHING;
          `);
        }
      }
    });
  }

  async assignToRole(params: { schoolId: string; role: UserRole; permissionCode: string }) {
    const [permission] = await this.dataSource.query(
      'SELECT code FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    await this.dataSource.query(
      `INSERT INTO user_permissions (user_id, school_id, permission_id)
       SELECT user_id, school_id, $1 FROM user_roles
       WHERE school_id = $2 AND role::text = $3
       ON CONFLICT (user_id, school_id, permission_id) DO NOTHING`,
      [permission.code, params.schoolId, params.role],
    );
    await this.invalidateSystemRoleUsersCache(params.schoolId, params.role);
    return { success: true };
  }

  // --- Global System Administration CRUDs ---

  async listAllOrganizations() {
    return this.dataSource.query(`
      SELECT o.*, COUNT(s.id) as school_count 
      FROM organizations o 
      LEFT JOIN schools s ON s.organization_id = o.id 
      GROUP BY o.id 
      ORDER BY o.created_at DESC
    `);
  }

  async listAllUsersGlobal() {
    return this.dataSource.query(`
      SELECT u.id, u.email, p.full_name, u.created_at,
             array_agg(DISTINCT ur.role) as global_roles
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      GROUP BY u.id, p.full_name
      ORDER BY u.created_at DESC
    `);
  }

  async updateOrganizationStatus(actorId: string, orgId: string, status: 'active' | 'suspended' | 'deleted') {
    return await this.dataSource.transaction(async (manager) => {
      const [org] = await manager.query(
        'UPDATE organizations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, status',
        [status, orgId]
      );

      if (!org) throw new NotFoundError('Organization not found');

      // Audit Logging: Track platform-wide status changes
      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actorId,
          `org:status_change:${status}`,
          'organization',
          orgId,
          JSON.stringify({ new_status: status }),
        ],
      );

      return org;
    });
  }

  /**
   * Platform-wide Role Protection: Promote or demote a System Admin.
   * This action is heavily audited and restricted to the System Admin Guard level.
   */
  async toggleSystemAdminStatus(actorId: string, targetUserId: string, isSystemAdmin: boolean) {
    return await this.dataSource.transaction(async (manager) => {
      const [user] = await manager.query(
        'UPDATE users SET is_system_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_system_admin',
        [isSystemAdmin, targetUserId]
      );

      if (!user) throw new NotFoundError('User not found');

      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actorId,
          isSystemAdmin ? 'user:promote_system_admin' : 'user:demote_system_admin',
          'user',
          targetUserId,
          JSON.stringify({ affected_user: user.email }),
        ],
      );

      return user;
    });
  }

  async getSystemStats() {
    const [stats] = await this.dataSource.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM users) as "totalUsers",
        (SELECT COUNT(*)::int FROM organizations WHERE status != 'deleted') as "totalOrganizations",
        (SELECT COUNT(*)::int FROM schools WHERE status != 'deleted') as "totalSchools",
        (SELECT COUNT(*)::int FROM sessions WHERE status = 'live') as "activeSessions"
    `);
    return {
      ...stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Soft deletes an organization. 
   * Recommended over hard delete to prevent accidental data loss across linked schools.
   */
  async softDeleteOrganization(actorId: string, orgId: string) {
    return await this.updateOrganizationStatus(actorId, orgId, 'deleted');
  }

  async revokeFromUser(params: { userId: string; schoolId: string; permissionCode: string }) {
    const [permission] = await this.dataSource.query(
      'SELECT code FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    await this.dataSource.query(
      'DELETE FROM user_permissions WHERE user_id = $1 AND school_id = $2 AND permission_id = $3',
      [params.userId, params.schoolId, permission.code],
    );
    await this.invalidateUserCache(params.userId, params.schoolId);
  }

  async listUserPermissions(userId: string, schoolId: string): Promise<string[]> {
    const cacheKey = `user_permissions:${userId}:${schoolId}`;
    const cachedPermissions = await this.cacheManager.get<string[]>(cacheKey);
    if (cachedPermissions) {
      return cachedPermissions;
    }

    // SQL Fix: Join on p.code because permission_id is text (stores code) and p.id is uuid. 
    // This resolves the [42883] "operator does not exist: text = uuid" error.
    const dbRows = await this.dataSource.query(
      `SELECT p.code FROM permissions p
       LEFT JOIN user_permissions up ON up.permission_id = p.code AND up.user_id = $1 AND up.school_id = $2
       LEFT JOIN role_permissions rp ON rp.permission_id = p.code AND rp.school_id = $2
       LEFT JOIN user_roles ur ON ur.user_id = $1 AND ur.school_id = $2 AND (ur.role::text = rp.role)
       WHERE up.id IS NOT NULL OR (rp.id IS NOT NULL AND ur.id IS NOT NULL)`,
      [userId, schoolId],
    );
    const dbPerms = dbRows.map((r: any) => r.code);
    
    // Fetch static capabilities mapped to the user's assigned base roles
    const roleRows = await this.dataSource.query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId],
    );

    const staticPerms = roleRows.flatMap((row: any) => 
      Array.from(ROLE_CAPABILITIES[row.role as UserRole] || [])
    );

    let allPermissions = Array.from(new Set([...dbPerms, ...staticPerms]));

    // Support Hierarchical Permissions & Wildcards: Expand '*' or 'all'
    if (allPermissions.includes('*') || allPermissions.includes('all')) {
      const catalog = await this.findAll();
      allPermissions = catalog.map((p: any) => p.code);
    }

    await this.cacheManager.set(cacheKey, allPermissions);
    return allPermissions;
  }

  private async invalidateUserCache(userId: string, schoolId: string) {
    await this.cacheManager.del(`user_permissions:${userId}:${schoolId}`);
  }

  private async invalidateRoleUsersCache(roleId: string) {
    const users = await this.dataSource.query(
      'SELECT user_id, school_id FROM user_roles WHERE role_id = $1',
      [roleId],
    );
    await Promise.all(users.map((u: any) => this.invalidateUserCache(u.user_id, u.school_id)));
  }

  private async invalidateSystemRoleUsersCache(schoolId: string, role: UserRole) {
    const users = await this.dataSource.query(
      'SELECT user_id FROM user_roles WHERE school_id = $1 AND role::text = $2',
      [schoolId, role],
    );
    await Promise.all(users.map((u: any) => this.invalidateUserCache(u.user_id, schoolId)));
  }
}
