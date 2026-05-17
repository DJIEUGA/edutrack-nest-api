import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { ConflictError, ForbiddenError, NotFoundError } from '@common/errors/domain.errors';
import { UserRole } from '@common/types/role.types';
import { canManageRole } from '@modules/roles/domain/staff-hierarchy';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { StaffInvitation } from '../domain/staff-invitation.entity';
import { StaffInvitationRepository } from '../infrastructure/staff-invitation.repository';

const INVITATION_TTL_HOURS = 72;

function freshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function expiryDate(): Date {
  return new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitations: StaffInvitationRepository,
    private readonly roleResolver: RoleResolverService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  listBySchool(schoolId: string) {
    return this.invitations.listBySchool(schoolId);
  }

  // ── Validate token (public — pre-fills the registration form) ─────────────

  async validateToken(token: string): Promise<{
    email: string;
    role: UserRole;
    schoolId: string;
    schoolName: string;
    departmentId: string | null;
    departmentIds: string[];
    expiresAt: Date;
    inviterName: string;
  }> {
    const inv = await this.invitations.findByToken(token);
    if (!inv) throw new NotFoundError('Invitation not found', { token: '***' });
    if (inv.status !== 'pending') {
      throw new BadRequestException(`Invitation is already '${inv.status}'`);
    }
    if (inv.expiresAt < new Date()) {
      await this.invitations.updateStatus(inv.id, 'expired');
      throw new BadRequestException('Invitation has expired');
    }

    const [[school], [inviter]] = await Promise.all([
      this.dataSource.query('SELECT name FROM schools WHERE id = $1', [inv.schoolId]),
      this.dataSource.query(
        'SELECT p.full_name FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = $1',
        [inv.invitedBy],
      ),
    ]);

    return {
      email: inv.email,
      role: inv.role,
      schoolId: inv.schoolId,
      schoolName: school?.name ?? '',
      departmentId: inv.departmentId ?? null,
      departmentIds: inv.departmentIds ?? [],
      expiresAt: inv.expiresAt,
      inviterName: inviter?.full_name ?? '',
    };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: {
    schoolId: string;
    email: string;
    role: UserRole;
    departmentId?: string | null;
    departmentIds?: string[];
    invitedBy: string;
  }): Promise<{ invitation?: StaffInvitation; userExists?: boolean; userId?: string; alreadyMember?: boolean }> {
    // 1. Hierarchy check — actor must be able to manage target role
    const actorRoles = await this.roleResolver.listRolesForUser(input.invitedBy, input.schoolId);
    if (!canManageRole(actorRoles, input.role)) {
      throw new ForbiddenError(
        `Your role does not permit inviting a '${input.role}'`,
        { yourRoles: actorRoles, targetRole: input.role },
      );
    }

    // 2. HoD department scope check
    if (actorRoles.includes('hod') && !actorRoles.some((r) => ['owner', 'admin', 'director'].includes(r))) {
      await this.assertHodDepartmentScope(input.invitedBy, input.schoolId, input.departmentId, input.departmentIds);
    }

    // 3. Check if the email already belongs to a user in the system
    const [existingUser] = await this.dataSource.query(
      'SELECT id FROM users WHERE email = $1',
      [input.email.toLowerCase()],
    );

    if (existingUser) {
      const [membership] = await this.dataSource.query(
        'SELECT id FROM school_memberships WHERE user_id = $1 AND school_id = $2',
        [existingUser.id, input.schoolId],
      );
      return {
        userExists: true,
        userId: existingUser.id,
        alreadyMember: !!membership,
      };
    }

    // 4. Prevent duplicate pending invitations to the same email+role
    const existing = await this.dataSource.query(
      `SELECT id FROM staff_invitations
       WHERE school_id = $1 AND email = $2 AND role = $3 AND status = 'pending'`,
      [input.schoolId, input.email.toLowerCase(), input.role],
    );
    if (existing.length > 0) {
      throw new ConflictError('A pending invitation already exists for this email and role', {
        existingId: existing[0].id,
      });
    }

    const deptIds = input.departmentIds?.length
      ? input.departmentIds
      : input.departmentId
      ? [input.departmentId]
      : [];

    const invitation = await this.invitations.create({
      schoolId: input.schoolId,
      email: input.email.toLowerCase(),
      role: input.role,
      departmentId: input.departmentId ?? null,
      departmentIds: deptIds,
      invitedBy: input.invitedBy,
      token: freshToken(),
      status: 'pending',
      acceptedAt: null,
      expiresAt: expiryDate(),
    });

    return { invitation };
  }

  // ── Resend (refresh token + expiry on expired or pending invitations) ──────

  async resend(schoolId: string, id: string, actorUserId: string): Promise<StaffInvitation> {
    const inv = await this.invitations.findById(id);
    if (!inv || inv.schoolId !== schoolId) {
      throw new NotFoundError('Invitation not found', { id });
    }
    if (inv.status === 'accepted') {
      throw new BadRequestException('Cannot resend an already accepted invitation');
    }
    if (inv.status === 'cancelled') {
      throw new BadRequestException('Cannot resend a cancelled invitation — create a new one');
    }

    // Hierarchy check for the actor resending
    const actorRoles = await this.roleResolver.listRolesForUser(actorUserId, schoolId);
    if (!canManageRole(actorRoles, inv.role)) {
      throw new ForbiddenError(`Your role does not permit managing a '${inv.role}'`, { actorRoles });
    }

    const updated = await this.invitations.refreshToken(id, freshToken(), expiryDate());
    return updated!;
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(schoolId: string, id: string, actorUserId: string): Promise<StaffInvitation> {
    const inv = await this.invitations.findById(id);
    if (!inv || inv.schoolId !== schoolId) {
      throw new NotFoundError('Invitation not found', { id });
    }
    if (inv.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel an invitation in '${inv.status}' state`);
    }

    const actorRoles = await this.roleResolver.listRolesForUser(actorUserId, schoolId);
    if (!canManageRole(actorRoles, inv.role)) {
      throw new ForbiddenError(`Your role does not permit cancelling a '${inv.role}' invitation`, { actorRoles });
    }

    const updated = await this.invitations.updateStatus(id, 'cancelled');
    return updated!;
  }

  // ── Complete registration (new user accepts invitation) ────────────────────

  async completeRegistration(
    token: string,
    data: { fullName: string; password: string },
  ): Promise<{ userId: string; email: string; role: UserRole; schoolId: string; fullName: string }> {
    const inv = await this.invitations.findByToken(token);
    if (!inv) throw new NotFoundError('Invitation not found', { token: '***' });
    if (inv.status !== 'pending') {
      throw new BadRequestException(`Invitation is already '${inv.status}'`);
    }
    if (inv.expiresAt < new Date()) {
      await this.invitations.updateStatus(inv.id, 'expired');
      throw new BadRequestException('Invitation has expired');
    }

    await this.invitations.updateStatus(inv.id, 'processing');

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const email = inv.email.toLowerCase();
        let userId: string;

        const [existingUser] = await manager.query(
          'SELECT id FROM users WHERE email = $1',
          [email],
        );

        if (existingUser) {
          userId = existingUser.id;
          // Update full name if the profile exists
          await manager.query(
            `UPDATE profiles SET full_name = COALESCE(NULLIF($2, ''), full_name) WHERE id = $1`,
            [userId, data.fullName],
          );
        } else {
          const hash = await bcrypt.hash(data.password, 10);
          const [newUser] = await manager.query(
            `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
            [email, hash],
          );
          userId = newUser.id;
          await manager.query(
            `INSERT INTO profiles (id, full_name) VALUES ($1, $2)`,
            [userId, data.fullName],
          );
        }

        // Add school membership (idempotent)
        await manager.query(
          `INSERT INTO school_memberships (school_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (school_id, user_id) DO NOTHING`,
          [inv.schoolId, userId],
        );

        // Assign the role — use first departmentId from departmentIds or departmentId
        const primaryDeptId = inv.departmentIds?.[0] ?? inv.departmentId ?? null;
        await manager.query(
          `INSERT INTO user_roles (user_id, school_id, role, department_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, school_id, role) DO UPDATE SET department_id = EXCLUDED.department_id`,
          [userId, inv.schoolId, inv.role, primaryDeptId],
        );

        // Audit log
        await manager.query(
          `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, 'invitation:completed', 'user', $1, $3)`,
          [userId, inv.schoolId, JSON.stringify({ role: inv.role, invitationId: inv.id })],
        );

        return { userId, email, fullName: data.fullName };
      });

      await this.invitations.updateStatus(inv.id, 'accepted', { acceptedAt: new Date() });
      return { ...result, role: inv.role, schoolId: inv.schoolId };
    } catch (err) {
      // Roll invitation back to pending so it can be retried
      await this.invitations.updateStatus(inv.id, 'pending');
      throw err;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertHodDepartmentScope(
    hodUserId: string,
    schoolId: string,
    departmentId?: string | null,
    departmentIds?: string[],
  ): Promise<void> {
    const hodRoles = await this.dataSource.query(
      `SELECT department_id FROM user_roles WHERE user_id = $1 AND school_id = $2 AND role = 'hod'`,
      [hodUserId, schoolId],
    );
    const managedDepts = new Set(hodRoles.map((r: { department_id: string }) => r.department_id).filter(Boolean));

    const requested = new Set([
      ...(departmentIds ?? []),
      ...(departmentId ? [departmentId] : []),
    ]);

    for (const dept of requested) {
      if (!managedDepts.has(dept)) {
        throw new ForbiddenError('You can only invite lecturers to departments you manage', {
          requestedDepartment: dept,
          managedDepartments: Array.from(managedDepts),
        });
      }
    }
  }
}
