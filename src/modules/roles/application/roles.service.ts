import { Injectable } from '@nestjs/common';
import { UserRole } from '@common/types/role.types';
import { AuditService } from '@modules/audit/application/audit.service';
import { UserRoleRepository } from '../infrastructure/user-role.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly userRoles: UserRoleRepository,
    private readonly audit: AuditService,
  ) {}

  async assignRole(input: {
    actorUserId: string;
    schoolId: string;
    targetUserId: string;
    role: UserRole;
    departmentId?: string | null;
  }) {
    const assignment = await this.userRoles.assign({
      userId: input.targetUserId,
      schoolId: input.schoolId,
      role: input.role,
      departmentId: input.departmentId ?? null,
    });
    await this.audit.log({
      actorUserId: input.actorUserId,
      scopeSchoolId: input.schoolId,
      action: 'user-role:assign',
      resourceType: 'user_role',
      resourceId: assignment.id,
      metadata: { targetUserId: input.targetUserId, role: input.role },
    });
    return assignment;
  }

  async revokeRole(input: {
    actorUserId: string;
    schoolId: string;
    targetUserId: string;
    role: UserRole;
  }) {
    await this.userRoles.revoke({
      userId: input.targetUserId,
      schoolId: input.schoolId,
      role: input.role,
    });
    await this.audit.log({
      actorUserId: input.actorUserId,
      scopeSchoolId: input.schoolId,
      action: 'user-role:revoke',
      resourceType: 'user_role',
      metadata: { targetUserId: input.targetUserId, role: input.role },
    });
  }

  listUserRolesBySchool(userId: string, schoolId: string) {
    return this.userRoles.listByUserAndSchool(userId, schoolId);
  }
}
