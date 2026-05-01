import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';
import { UserRole } from '@common/types/role.types';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from '../api/dto/create-user.dto';
import { UpdateUserDto } from '../api/dto/update-user.dto';
import { ResetPasswordDto } from '../api/dto/reset-password.dto';
import { UserListItemDto, UserSearchResponseDto } from '../api/dto/user-search-response.dto';

@Injectable()
export class UsersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findByEmail(email: string) {
    const [user] = await this.dataSource.query(
      'SELECT id, email, password_hash as "passwordHash", is_active as "isActive" FROM users WHERE email = $1',
      [email],
    );
    return user;
  }

  async getById(id: string) {
    const [user] = await this.dataSource.query(
      'SELECT id, email, is_active as "isActive" FROM users WHERE id = $1',
      [id],
    );
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async listBySchool(schoolId: string): Promise<UserListItemDto[]> {
    const rows = await this.dataSource.query(
      `SELECT u.id, u.email, u.is_active, p.full_name, p.phone, p.avatar_url, ur.role
       FROM users u
       JOIN profiles p ON u.id = p.id
       JOIN school_memberships sm ON u.id = sm.user_id
       JOIN user_roles ur ON u.id = ur.user_id AND ur.school_id = sm.school_id
       WHERE sm.school_id = $1
       ORDER BY p.full_name ASC`,
      [schoolId],
    );
    return plainToInstance(UserListItemDto, rows as object[]);
  }

  async searchInSchool(
    schoolId: string,
    query?: string,
    role?: UserRole,
    limit: number = 20,
    offset: number = 0,
  ): Promise<UserSearchResponseDto> {
    const baseConditions = `
      FROM users u
      JOIN profiles p ON u.id = p.id
      JOIN school_memberships sm ON u.id = sm.user_id
      JOIN user_roles ur ON u.id = ur.user_id AND ur.school_id = sm.school_id
      WHERE sm.school_id = $1 
        AND ($2::text IS NULL OR u.email ILIKE $2 OR p.full_name ILIKE $2)
        AND ($3::text IS NULL OR ur.role = $3::user_role)
    `;

    const items = await this.dataSource.query(
      `SELECT u.id, u.email, u.is_active, p.full_name, p.phone, p.avatar_url, ur.role
       ${baseConditions}
       ORDER BY p.full_name ASC
       LIMIT $4 OFFSET $5`,
      [schoolId, query ? `%${query}%` : null, role || null, limit, offset],
    );

    const countResult = await this.dataSource.query(
      `SELECT COUNT(*)::int as total ${baseConditions}`,
      [schoolId, query ? `%${query}%` : null, role || null],
    );

    const total = countResult[0]?.total || 0;

    return plainToInstance(UserSearchResponseDto, {
      items,
      meta: {
        total,
        limit,
        offset,
      },
    });
  }

  async getByIdInSchool(userId: string, schoolId: string): Promise<UserListItemDto> {
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.is_active, p.full_name, p.phone, p.avatar_url, ur.role
       FROM users u
       JOIN profiles p ON u.id = p.id
       JOIN school_memberships sm ON u.id = sm.user_id
       JOIN user_roles ur ON u.id = ur.user_id AND ur.school_id = sm.school_id
       WHERE u.id = $1 AND sm.school_id = $2`,
      [userId, schoolId],
    );
    if (!user) throw new NotFoundError('User not found in this school');
    return plainToInstance(UserListItemDto, user);
  }

  async createInSchool(actorId: string, schoolId: string, dto: CreateUserDto): Promise<UserListItemDto> {
    const { id } = await this.dataSource.transaction(async (manager) => {
      const [existing] = await manager.query('SELECT id FROM users WHERE email = $1', [dto.email]);
      
      let userId: string;

      if (existing) {
        userId = existing.id;
        const [membership] = await manager.query(
          'SELECT id FROM school_memberships WHERE user_id = $1 AND school_id = $2',
          [userId, schoolId]
        );
        if (membership) throw new ConflictError('User is already a member of this school');
      } else {
        const password = dto.password || Math.random().toString(36).slice(-10);
        const hash = await bcrypt.hash(password, 10);
        
        const [user] = await manager.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          [dto.email, hash]
        );
        userId = user.id;

        await manager.query(
          'INSERT INTO profiles (id, full_name) VALUES ($1, $2)',
          [userId, dto.fullName]
        );
      }

      await manager.query(
        'INSERT INTO school_memberships (school_id, user_id) VALUES ($1, $2)',
        [schoolId, userId]
      );

      await manager.query(
        'INSERT INTO user_roles (user_id, school_id, role) VALUES ($1, $2, $3)',
        [userId, schoolId, dto.role]
      );

      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actorId, schoolId, 'user:create_in_school', 'user', userId, JSON.stringify({ email: dto.email, role: dto.role })]
      );

      return { id: userId };
    });
    return this.getByIdInSchool(id, schoolId);
  }

  async updateInSchool(userId: string, schoolId: string, dto: UpdateUserDto): Promise<UserListItemDto> {
    await this.dataSource.transaction(async (manager) => {
      if (dto.fullName || dto.phone) {
        await manager.query(
          `UPDATE profiles SET 
           full_name = COALESCE($2, full_name), 
           phone = COALESCE($3, phone) 
           WHERE id = $1`,
          [userId, dto.fullName, dto.phone]
        );
      }
      
      if (dto.isActive !== undefined) {
        await manager.query('UPDATE users SET is_active = $2 WHERE id = $1', [userId, dto.isActive]);
      }
    });
    return this.getByIdInSchool(userId, schoolId);
  }

  async removeFromSchool(actorId: string, userId: string, schoolId: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        'DELETE FROM school_memberships WHERE user_id = $1 AND school_id = $2',
        [userId, schoolId]
      );

      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [actorId, schoolId, 'user:remove_from_school', 'user', userId]
      );
    });
    return { success: true };
  }

  async resetPassword(actorId: string, userId: string, schoolId: string, dto: ResetPasswordDto) {
    await this.getByIdInSchool(userId, schoolId);
    const hash = await bcrypt.hash(dto.password, 10);

    await this.dataSource.transaction(async (manager) => {
      await manager.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, hash]);
      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [actorId, schoolId, 'user:password_reset', 'user', userId]
      );
    });
    return { success: true };
  }
}