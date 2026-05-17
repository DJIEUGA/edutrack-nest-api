import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InvitationStatus, StaffInvitation } from '../domain/staff-invitation.entity';

@Injectable()
export class StaffInvitationRepository {
  constructor(
    @InjectRepository(StaffInvitation)
    private readonly repo: Repository<StaffInvitation>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<StaffInvitation | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByToken(token: string): Promise<StaffInvitation | null> {
    return this.repo.findOne({ where: { token } });
  }

  /** Returns all invitations for a school with inviter name joined. */
  listBySchool(schoolId: string): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT
         si.id, si.email, si.role, si.department_id AS "departmentId",
         si.department_ids AS "departmentIds",
         si.status, si.expires_at AS "expiresAt",
         si.accepted_at AS "acceptedAt",
         si.created_at AS "createdAt",
         json_build_object('id', u.id, 'fullName', p.full_name, 'email', u.email) AS "invitedBy"
       FROM staff_invitations si
       JOIN users u ON si.invited_by = u.id
       JOIN profiles p ON p.id = u.id
       WHERE si.school_id = $1
       ORDER BY si.created_at DESC`,
      [schoolId],
    );
  }

  create(input: Omit<StaffInvitation, 'id' | 'createdAt' | 'updatedAt'>): Promise<StaffInvitation> {
    return this.repo.save(this.repo.create(input));
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
    extra?: Partial<Pick<StaffInvitation, 'acceptedAt' | 'token' | 'expiresAt'>>,
  ): Promise<StaffInvitation | null> {
    await this.repo.update({ id }, { status, ...extra });
    return this.repo.findOne({ where: { id } });
  }

  async refreshToken(id: string, token: string, expiresAt: Date): Promise<StaffInvitation | null> {
    await this.repo.update({ id }, { token, expiresAt, status: 'pending' });
    return this.repo.findOne({ where: { id } });
  }
}
