import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@common/types/role.types';
import { UserRoleAssignment } from '../domain/user-role.entity';

@Injectable()
export class UserRoleRepository {
  constructor(
    @InjectRepository(UserRoleAssignment)
    private readonly repo: Repository<UserRoleAssignment>,
  ) {}

  listByUserAndSchool(userId: string, schoolId: string): Promise<UserRoleAssignment[]> {
    return this.repo.find({ where: { userId, schoolId } });
  }

  listByUser(userId: string): Promise<UserRoleAssignment[]> {
    return this.repo.find({ where: { userId } });
  }

  findOne(input: {
    userId: string;
    schoolId: string;
    role: UserRole;
  }): Promise<UserRoleAssignment | null> {
    return this.repo.findOne({ where: input });
  }

  async assign(input: {
    userId: string;
    schoolId: string;
    role: UserRole;
    departmentId?: string | null;
  }): Promise<UserRoleAssignment> {
    const existing = await this.findOne({
      userId: input.userId,
      schoolId: input.schoolId,
      role: input.role,
    });
    if (existing) {
      if (input.departmentId !== undefined && existing.departmentId !== input.departmentId) {
        existing.departmentId = input.departmentId;
        return this.repo.save(existing);
      }
      return existing;
    }
    const created = this.repo.create({
      userId: input.userId,
      schoolId: input.schoolId,
      role: input.role,
      departmentId: input.departmentId ?? null,
    });
    return this.repo.save(created);
  }

  async revoke(input: { userId: string; schoolId: string; role: UserRole }): Promise<void> {
    await this.repo.delete(input);
  }
}
