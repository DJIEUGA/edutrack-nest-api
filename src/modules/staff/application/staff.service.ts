import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from '@common/errors/domain.errors';
import { UserRole } from '@common/types/role.types';
import { canManageRole, STAFF_ROLES } from '@modules/roles/domain/staff-hierarchy';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { PermissionsService } from '@modules/roles/application/permissions.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly roleResolver: RoleResolverService,
    private readonly permissions: PermissionsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ── Staff roster ──────────────────────────────────────────────────────────

  async listStaff(
    schoolId: string,
    filters: { role?: string; departmentId?: string; q?: string } = {},
  ): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT
         u.id, u.email, u.is_active AS "isActive",
         p.full_name AS "fullName", p.avatar_url AS "avatarUrl", p.phone,
         sm.created_at AS "joinedAt",
         json_agg(DISTINCT jsonb_build_object(
           'role', ur.role,
           'departmentId', ur.department_id,
           'departmentName', d.name
         )) AS roles
       FROM users u
       JOIN profiles p ON u.id = p.id
       JOIN school_memberships sm ON u.id = sm.user_id AND sm.school_id = $1
       JOIN user_roles ur ON u.id = ur.user_id AND ur.school_id = $1
       LEFT JOIN departments d ON ur.department_id = d.id
       WHERE ur.role = ANY($2::user_role[])
         AND ($3::text IS NULL OR ur.role = $3)
         AND ($4::uuid IS NULL OR ur.department_id = $4)
         AND ($5::text IS NULL OR p.full_name ILIKE $5 OR u.email ILIKE $5)
       GROUP BY u.id, p.full_name, p.avatar_url, p.phone, sm.created_at
       ORDER BY p.full_name ASC`,
      [
        schoolId,
        STAFF_ROLES,
        filters.role ?? null,
        filters.departmentId ?? null,
        filters.q ? `%${filters.q}%` : null,
      ],
    );
  }

  async getStaffProfile(schoolId: string, actorUserId: string, targetUserId: string): Promise<unknown> {
    // Any school member with management capability can view; actor can always view themselves
    if (actorUserId !== targetUserId) {
      const actorRoles = await this.roleResolver.listRolesForUser(actorUserId, schoolId);
      const targetRoles = await this.roleResolver.listRolesForUser(targetUserId, schoolId);
      const canSee = targetRoles.some((r) => canManageRole(actorRoles, r));
      if (!canSee && !actorRoles.some((r) => (STAFF_ROLES as readonly string[]).includes(r))) {
        throw new ForbiddenError('You do not have permission to view this staff profile');
      }
    }

    const [base] = await this.dataSource.query(
      `SELECT
         u.id, u.email, u.is_active AS "isActive",
         p.full_name AS "fullName", p.avatar_url AS "avatarUrl", p.phone,
         sm.created_at AS "joinedAt",
         json_agg(DISTINCT jsonb_build_object(
           'role', ur.role,
           'departmentId', ur.department_id,
           'departmentName', d.name
         )) AS roles
       FROM users u
       JOIN profiles p ON u.id = p.id
       JOIN school_memberships sm ON u.id = sm.user_id AND sm.school_id = $1
       JOIN user_roles ur ON u.id = ur.user_id AND ur.school_id = $1
       LEFT JOIN departments d ON ur.department_id = d.id
       WHERE u.id = $2
       GROUP BY u.id, p.full_name, p.avatar_url, p.phone, sm.created_at`,
      [schoolId, targetUserId],
    );
    if (!base) throw new NotFoundError('Staff member not found in this school', { userId: targetUserId });

    // Fetch the user's email for invitation history lookup
    const [emailRow] = await this.dataSource.query('SELECT email FROM users WHERE id = $1', [targetUserId]);

    const [courseAssignments, invitationHistory] = await Promise.all([
      // Course assignments (relevant for lecturers)
      this.dataSource.query(
        `SELECT ca.id, c.code AS "courseCode", c.title AS "courseTitle",
                cl.name AS "className", ay.name AS "academicYear"
         FROM course_assignments ca
         JOIN courses c ON ca.course_id = c.id
         JOIN classes cl ON ca.class_id = cl.id
         JOIN academic_years ay ON ca.academic_year_id = ay.id
         WHERE ca.lecturer_user_id = $1 AND ca.school_id = $2
         ORDER BY ay.start_date DESC, c.code ASC`,
        [targetUserId, schoolId],
      ),
      // Invitation history (visible in audit regardless of staff status per requirements)
      emailRow
        ? this.dataSource.query(
            `SELECT si.id, si.role, si.status,
                    si.created_at AS "createdAt", si.accepted_at AS "acceptedAt"
             FROM staff_invitations si
             WHERE si.email = $1 AND si.school_id = $2
             ORDER BY si.created_at DESC
             LIMIT 10`,
            [emailRow.email, schoolId],
          )
        : Promise.resolve([]),
    ]);

    return { ...base, courseAssignments, invitationHistory };
  }

  // ── Change role (atomic) ──────────────────────────────────────────────────

  async changeRole(input: {
    schoolId: string;
    actorUserId: string;
    targetUserId: string;
    fromRole: UserRole;
    toRole: UserRole;
    departmentId?: string;
  }): Promise<void> {
    const actorRoles = await this.roleResolver.listRolesForUser(input.actorUserId, input.schoolId);

    if (!canManageRole(actorRoles, input.fromRole)) {
      throw new ForbiddenError(`You cannot manage a '${input.fromRole}'`, { actorRoles });
    }
    if (!canManageRole(actorRoles, input.toRole)) {
      throw new ForbiddenError(`You cannot assign the '${input.toRole}' role`, { actorRoles });
    }

    // Verify target has the fromRole
    const [existingRole] = await this.dataSource.query(
      `SELECT id FROM user_roles WHERE user_id = $1 AND school_id = $2 AND role = $3`,
      [input.targetUserId, input.schoolId, input.fromRole],
    );
    if (!existingRole) {
      throw new NotFoundError(`Staff member does not hold the '${input.fromRole}' role`, {
        targetUserId: input.targetUserId,
        fromRole: input.fromRole,
      });
    }

    // Prevent assigning a role the target already has
    const [alreadyHas] = await this.dataSource.query(
      `SELECT id FROM user_roles WHERE user_id = $1 AND school_id = $2 AND role = $3`,
      [input.targetUserId, input.schoolId, input.toRole],
    );
    if (alreadyHas) {
      throw new ConflictError(`Staff member already holds the '${input.toRole}' role`, {
        toRole: input.toRole,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM user_roles WHERE user_id = $1 AND school_id = $2 AND role = $3`,
        [input.targetUserId, input.schoolId, input.fromRole],
      );

      await manager.query(
        `INSERT INTO user_roles (user_id, school_id, role, department_id)
         VALUES ($1, $2, $3, $4)`,
        [input.targetUserId, input.schoolId, input.toRole, input.departmentId ?? null],
      );

      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, 'staff:role_changed', 'user', $3, $4)`,
        [
          input.actorUserId,
          input.schoolId,
          input.targetUserId,
          JSON.stringify({ fromRole: input.fromRole, toRole: input.toRole, departmentId: input.departmentId }),
        ],
      );
    });
  }

  // ── Remove staff ──────────────────────────────────────────────────────────

  async removeStaff(schoolId: string, actorUserId: string, targetUserId: string): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new ValidationError('You cannot remove yourself from the school');
    }

    const actorRoles = await this.roleResolver.listRolesForUser(actorUserId, schoolId);
    const targetRoles = await this.roleResolver.listRolesForUser(targetUserId, schoolId);

    if (targetRoles.length === 0) {
      throw new NotFoundError('Staff member not found in this school', { targetUserId });
    }

    const canRemove = targetRoles.some((r) => canManageRole(actorRoles, r));
    if (!canRemove) {
      throw new ForbiddenError('You do not have authority to remove this staff member', {
        actorRoles,
        targetRoles,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      // Remove role assignments for this school
      await manager.query(
        `DELETE FROM user_roles WHERE user_id = $1 AND school_id = $2`,
        [targetUserId, schoolId],
      );

      // Remove school membership (course_assignments intentionally kept per requirements)
      await manager.query(
        `DELETE FROM school_memberships WHERE user_id = $1 AND school_id = $2`,
        [targetUserId, schoolId],
      );

      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, 'staff:removed', 'user', $3, $4)`,
        [
          actorUserId,
          schoolId,
          targetUserId,
          JSON.stringify({ removedRoles: targetRoles }),
        ],
      );
    });
  }

  // ── Permissions on behalf of actor ────────────────────────────────────────

  async grantPermission(
    schoolId: string,
    actorUserId: string,
    targetUserId: string,
    permissionCode: string,
  ): Promise<void> {
    const actorRoles = await this.roleResolver.listRolesForUser(actorUserId, schoolId);
    const targetRoles = await this.roleResolver.listRolesForUser(targetUserId, schoolId);

    const canGrant = targetRoles.some((r) => canManageRole(actorRoles, r));
    if (!canGrant) {
      throw new ForbiddenError('You cannot grant permissions to this staff member', { actorRoles, targetRoles });
    }

    await this.permissions.assignToUser({ userId: targetUserId, schoolId, permissionCode });
  }

  async revokePermission(
    schoolId: string,
    actorUserId: string,
    targetUserId: string,
    permissionCode: string,
  ): Promise<void> {
    const actorRoles = await this.roleResolver.listRolesForUser(actorUserId, schoolId);
    const targetRoles = await this.roleResolver.listRolesForUser(targetUserId, schoolId);

    const canRevoke = targetRoles.some((r) => canManageRole(actorRoles, r));
    if (!canRevoke) {
      throw new ForbiddenError('You cannot revoke permissions from this staff member', { actorRoles, targetRoles });
    }

    await this.permissions.revokeFromUser({ userId: targetUserId, schoolId, permissionCode });
  }
}
