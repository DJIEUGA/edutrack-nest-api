import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../domain/profile.entity';

@Injectable()
export class ProfileRepository {
  constructor(
    @InjectRepository(Profile)
    private readonly repo: Repository<Profile>,
  ) {}

  findByUserId(userId: string): Promise<Profile | null> {
    return this.repo.findOne({ where: { id: userId } });
  }

  async upsert(input: { userId: string; fullName: string; phone?: string | null }): Promise<Profile> {
    let profile = await this.findByUserId(input.userId);
    if (!profile) {
      profile = this.repo.create({
        id: input.userId,
        fullName: input.fullName,
        phone: input.phone ?? null,
      });
    } else {
      profile.fullName = input.fullName;
      profile.phone = input.phone ?? profile.phone;
    }
    return this.repo.save(profile);
  }

  async updatePartial(
    userId: string,
    patch: Partial<Pick<Profile, 'fullName' | 'phone' | 'avatarUrl'>>,
  ): Promise<Profile | null> {
    await this.repo.update({ id: userId }, patch);
    return this.findByUserId(userId);
  }
}
