import { Injectable } from '@nestjs/common';
import { UserRole } from '@common/types/role.types';
import { UserRoleRepository } from '../infrastructure/user-role.repository';

@Injectable()
export class RoleResolverService {
  constructor(private readonly userRoles: UserRoleRepository) {}

  async listRolesForUser(userId: string, schoolId?: string): Promise<UserRole[]> {
    const rows = schoolId
      ? await this.userRoles.listByUserAndSchool(userId, schoolId)
      : await this.userRoles.listByUser(userId);
    return rows.map((r) => r.role);
  }

  async userHasRoleInSchool(
    userId: string,
    schoolId: string,
    roles: UserRole[],
  ): Promise<boolean> {
    const granted = await this.listRolesForUser(userId, schoolId);
    return roles.some((r) => granted.includes(r));
  }
}
