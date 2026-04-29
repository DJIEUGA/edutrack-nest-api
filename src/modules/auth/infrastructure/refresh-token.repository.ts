import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RefreshToken } from '../domain/refresh-token.entity';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    const entity = this.repo.create({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    });
    return this.repo.save(entity);
  }

  findActiveByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
  }

  async revoke(id: string, replacedBy?: string): Promise<void> {
    await this.repo.update(
      { id },
      { revokedAt: new Date(), replacedBy: replacedBy ?? null },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async deleteExpired(): Promise<void> {
    await this.repo.delete({ expiresAt: LessThan(new Date()) });
  }
}
