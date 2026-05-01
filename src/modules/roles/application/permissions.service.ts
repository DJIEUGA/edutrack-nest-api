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
      'SELECT * FROM roles WHERE school_id = $1 OR is_system = true ORDER BY name ASC',
      [schoolId],
    );
  }

  async createRole(schoolId: string, data: { code: string; name: string }) {
    const [result] = await this.dataSource.query(
      `INSERT INTO roles (school_id, code, name, is_system) 
       VALUES ($1, $2, $3, false) 
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
      'SELECT id FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    try {
      await this.dataSource.query(
        `INSERT INTO user_permissions (user_id, school_id, permission_id) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id, school_id, permission_id) DO NOTHING`,
        [params.userId, params.schoolId, permission.id],
      );
      await this.invalidateUserCache(params.userId, params.schoolId);
    } catch (error: any) {
      throw new Error(`Failed to assign permission: ${error.message}`);
    }
    return { success: true };
  }

  async assignPermissionToRole(params: { roleId: string; permissionCode: string }) {
    const [permission] = await this.dataSource.query(
      'SELECT id FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    await this.dataSource.query(
      `INSERT INTO role_permissions (role_id, permission_id) 
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [params.roleId, permission.id],
    );
    await this.invalidateRoleUsersCache(params.roleId);
  }

  async assignToRole(params: { schoolId: string; role: UserRole; permissionCode: string }) {
    const [permission] = await this.dataSource.query(
      'SELECT id FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    await this.dataSource.query(
      `INSERT INTO user_permissions (user_id, school_id, permission_id)
       SELECT user_id, school_id, $1 FROM user_roles
       WHERE school_id = $2 AND role = $3
       ON CONFLICT (user_id, school_id, permission_id) DO NOTHING`,
      [permission.id, params.schoolId, params.role],
    );
    await this.invalidateSystemRoleUsersCache(params.schoolId, params.role);
    return { success: true };
  }

  async revokeFromUser(params: { userId: string; schoolId: string; permissionCode: string }) {
    const [permission] = await this.dataSource.query(
      'SELECT id FROM permissions WHERE code = $1',
      [params.permissionCode],
    );
    if (!permission) throw new NotFoundError(`Permission ${params.permissionCode} not found`);

    await this.dataSource.query(
      'DELETE FROM user_permissions WHERE user_id = $1 AND school_id = $2 AND permission_id = $3',
      [params.userId, params.schoolId, permission.id],
    );
    await this.invalidateUserCache(params.userId, params.schoolId);
  }

  async listUserPermissions(userId: string, schoolId: string): Promise<string[]> {
    const cacheKey = `user_permissions:${userId}:${schoolId}`;
    const cachedPermissions = await this.cacheManager.get<string[]>(cacheKey);
    if (cachedPermissions) {
      return cachedPermissions;
    }

    // Fetch permissions granted via direct assignment or dynamic roles in DB
    const dbRows = await this.dataSource.query(
      `SELECT p.code FROM permissions p
       LEFT JOIN user_permissions up ON up.permission_id = p.id AND up.user_id = $1 AND up.school_id = $2
       LEFT JOIN role_permissions rp ON rp.permission_id = p.id
       LEFT JOIN roles r ON r.id = rp.role_id
       LEFT JOIN user_roles ur ON (ur.role_id = r.id OR ur.role::text = r.code) 
         AND ur.user_id = $1 AND ur.school_id = $2
       WHERE up.id IS NOT NULL OR ur.id IS NOT NULL`,
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

    const allPermissions = Array.from(new Set([...dbPerms, ...staticPerms]));
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
    for (const u of users) {
      await this.invalidateUserCache(u.user_id, u.school_id);
    }
  }

  private async invalidateSystemRoleUsersCache(schoolId: string, role: UserRole) {
    const users = await this.dataSource.query(
      'SELECT user_id FROM user_roles WHERE school_id = $1 AND role = $2',
      [schoolId, role],
    );
    for (const u of users) {
      await this.invalidateUserCache(u.user_id, schoolId);
    }
  }
}
