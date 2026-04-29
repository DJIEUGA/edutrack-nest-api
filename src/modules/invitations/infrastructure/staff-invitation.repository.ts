import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvitationStatus, StaffInvitation } from '../domain/staff-invitation.entity';

@Injectable()
export class StaffInvitationRepository {
  constructor(
    @InjectRepository(StaffInvitation)
    private readonly repo: Repository<StaffInvitation>,
  ) {}

  findById(id: string): Promise<StaffInvitation | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByToken(token: string): Promise<StaffInvitation | null> {
    return this.repo.findOne({ where: { token } });
  }

  listBySchool(schoolId: string): Promise<StaffInvitation[]> {
    return this.repo.find({ where: { schoolId }, order: { createdAt: 'DESC' } });
  }

  create(input: Omit<StaffInvitation, 'id' | 'createdAt' | 'updatedAt'>): Promise<StaffInvitation> {
    return this.repo.save(this.repo.create(input));
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
    extra?: Partial<Pick<StaffInvitation, 'acceptedAt'>>,
  ): Promise<StaffInvitation | null> {
    await this.repo.update({ id }, { status, ...extra });
    return this.findById(id);
  }
}
