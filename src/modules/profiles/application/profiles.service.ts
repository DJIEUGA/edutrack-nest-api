import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@common/errors/domain.errors';
import { Profile } from '../domain/profile.entity';
import { ProfileRepository } from '../infrastructure/profile.repository';

@Injectable()
export class ProfilesService {
  constructor(private readonly profiles: ProfileRepository) {}

  findByUserId(userId: string): Promise<Profile | null> {
    return this.profiles.findByUserId(userId);
  }

  async getByUserId(userId: string): Promise<Profile> {
    const p = await this.profiles.findByUserId(userId);
    if (!p) throw new NotFoundError('Profile not found', { userId });
    return p;
  }

  async update(userId: string, patch: { fullName?: string; phone?: string }): Promise<Profile> {
    const cleaned: Partial<Profile> = {};
    if (patch.fullName !== undefined) cleaned.fullName = patch.fullName;
    if (patch.phone !== undefined) cleaned.phone = patch.phone || null;
    const updated = await this.profiles.updatePartial(userId, cleaned);
    if (!updated) {
      // No row yet — bootstrap a minimal profile with whatever name was provided.
      return this.profiles.upsert({
        userId,
        fullName: patch.fullName ?? 'New User',
        phone: patch.phone ?? null,
      });
    }
    return updated;
  }

  async setAvatar(userId: string, avatarUrl: string): Promise<Profile> {
    const updated = await this.profiles.updatePartial(userId, { avatarUrl });
    if (!updated) throw new NotFoundError('Profile not found', { userId });
    return updated;
  }

  async clearAvatar(userId: string): Promise<Profile> {
    const updated = await this.profiles.updatePartial(userId, { avatarUrl: null });
    if (!updated) throw new NotFoundError('Profile not found', { userId });
    return updated;
  }
}
