import { Injectable, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '@common/types/role.types';
import { ForbiddenError, NotFoundError } from '@common/errors/domain.errors';
import { ROLE_CAPABILITIES } from '../domain/role-capabilities';
import { canManageRole } from '../domain/staff-hierarchy';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RolesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async listUserRolesBySchool(userId: string, schoolId: string) {
    const rows = await this.dataSource.query(
      `SELECT
         ur.*,
         dr.name as dynamic_role_name,
         dr.code as dynamic_role_code,
         COALESCE(
           (SELECT json_agg(rp.permission_id)
            FROM role_permissions rp
            WHERE rp.school_id = ur.school_id
              AND rp.role = ur.role::text
           ),
           '[]'::json
         ) as db_permissions
       FROM user_roles ur
       LEFT JOIN dynamic_roles dr ON ur.role_id = dr.id
       WHERE ur.user_id = $1 AND ur.school_id = $2`,
      [userId, schoolId],
    );

    return rows.map((row: any) => {
      const staticCaps = Array.from(ROLE_CAPABILITIES[row.role as UserRole] || []);
      const dbPerms = (row.db_permissions || []) as string[];
      
      const { db_permissions, ...cleanRow } = row;
      return {
        ...cleanRow,
        permissions: Array.from(new Set([...staticCaps, ...dbPerms])),
      };
    });
  }

  async assignRole(params: {
    actorUserId: string;
    schoolId: string;
    targetUserId: string;
    role: UserRole;
    roleId?: string;
    departmentId?: string;
  }) {
    // Hierarchy enforcement: actor must be able to manage the target role
    const actorRoles = await this.listUserRolesBySchool(params.actorUserId, params.schoolId).then(
      (rows) => rows.map((r: { role: string }) => r.role as UserRole),
    );
    if (!canManageRole(actorRoles, params.role)) {
      throw new ForbiddenError(
        `Your role does not permit assigning the '${params.role}' role`,
        { actorRoles, targetRole: params.role },
      );
    }

    // If a dynamic roleId is provided, verify it exists and belongs to this school
    if (params.roleId) {
      const [role] = await this.dataSource.query(
        'SELECT id FROM dynamic_roles WHERE id = $1 AND school_id = $2',
        [params.roleId, params.schoolId],
      );
      if (!role) throw new NotFoundError('Dynamic role not found or inaccessible');
    }

    // Upsert the user role assignment
    await this.dataSource.query(
      `INSERT INTO user_roles (user_id, school_id, role, role_id, department_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, school_id, role) 
       DO UPDATE SET 
         role_id = EXCLUDED.role_id, 
         department_id = EXCLUDED.department_id,
         updated_at = now()`,
      [params.targetUserId, params.schoolId, params.role, params.roleId, params.departmentId],
    );

    await this.cacheManager.del(`user_permissions:${params.targetUserId}:${params.schoolId}`);
    return { success: true };
  }

  async revokeRole(params: {
    actorUserId: string;
    schoolId: string;
    targetUserId: string;
    role: UserRole;
  }) {
    // Hierarchy enforcement
    const actorRoles = await this.listUserRolesBySchool(params.actorUserId, params.schoolId).then(
      (rows) => rows.map((r: { role: string }) => r.role as UserRole),
    );
    if (!canManageRole(actorRoles, params.role)) {
      throw new ForbiddenError(
        `Your role does not permit revoking the '${params.role}' role`,
        { actorRoles, targetRole: params.role },
      );
    }

    await this.dataSource.query(
      'DELETE FROM user_roles WHERE user_id = $1 AND school_id = $2 AND role = $3',
      [params.targetUserId, params.schoolId, params.role],
    );
    await this.cacheManager.del(`user_permissions:${params.targetUserId}:${params.schoolId}`);
    return { success: true };
  }
}