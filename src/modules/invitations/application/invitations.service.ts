import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { NotFoundError } from '@common/errors/domain.errors';
import { UserRole } from '@common/types/role.types';
import { StaffInvitation } from '../domain/staff-invitation.entity';
import { StaffInvitationRepository } from '../infrastructure/staff-invitation.repository';

const INVITATION_TTL_HOURS = 72;

@Injectable()
export class InvitationsService {
  constructor(private readonly invitations: StaffInvitationRepository) {}

  listBySchool(schoolId: string): Promise<StaffInvitation[]> {
    return this.invitations.listBySchool(schoolId);
  }

  async create(input: {
    schoolId: string;
    email: string;
    role: UserRole;
    departmentId?: string | null;
    invitedBy: string;
  }): Promise<StaffInvitation> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
    return this.invitations.create({
      ...input,
      departmentId: input.departmentId ?? null,
      token,
      status: 'pending',
      acceptedAt: null,
      expiresAt,
    });
  }

  async accept(token: string): Promise<StaffInvitation> {
    const invitation = await this.invitations.findByToken(token);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or already used', { token: '***' });
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Invitation is already '${invitation.status}'`);
    }
    if (invitation.expiresAt < new Date()) {
      await this.invitations.updateStatus(invitation.id, 'expired');
      throw new BadRequestException('Invitation has expired');
    }
    await this.invitations.updateStatus(invitation.id, 'processing');
    const updated = await this.invitations.updateStatus(invitation.id, 'accepted', {
      acceptedAt: new Date(),
    });
    return updated!;
  }

  async cancel(schoolId: string, id: string): Promise<StaffInvitation> {
    const invitation = await this.invitations.findById(id);
    if (!invitation || invitation.schoolId !== schoolId) {
      throw new NotFoundError('Invitation not found', { id });
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel an invitation in '${invitation.status}' state`);
    }
    const updated = await this.invitations.updateStatus(id, 'cancelled');
    return updated!;
  }
}
