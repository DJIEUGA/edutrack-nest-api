import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { UnauthorizedError } from '@common/errors/domain.errors';
import { RefreshTokenRepository } from '../infrastructure/refresh-token.repository';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  async issueTokenPair(user: { id: string; email: string }): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.getOrThrow<string>('jwt.accessTtl'),
      issuer: this.config.get<string>('jwt.issuer'),
      audience: this.config.get<string>('jwt.audience'),
    });

    const { token: refreshToken, expiresAt } = this.generateRefreshToken();
    await this.refreshRepo.create({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: this.config.getOrThrow<string>('jwt.accessTtl'),
      refreshExpiresIn: this.config.getOrThrow<string>('jwt.refreshTtl'),
    };
  }

  async resolveActiveRefreshToken(presented: string): Promise<{ id: string; userId: string; expiresAt: Date }> {
    const hash = this.hashToken(presented);
    const existing = await this.refreshRepo.findActiveByHash(hash);
    if (!existing) throw new UnauthorizedError('Invalid refresh token');
    if (existing.expiresAt.getTime() <= Date.now()) {
      await this.refreshRepo.revoke(existing.id);
      throw new UnauthorizedError('Refresh token expired');
    }
    return { id: existing.id, userId: existing.userId, expiresAt: existing.expiresAt };
  }

  async rotateRefreshToken(presented: string, user: { id: string; email: string }): Promise<TokenPair> {
    const existing = await this.resolveActiveRefreshToken(presented);
    if (existing.userId !== user.id) throw new UnauthorizedError('Token/user mismatch');

    const next = await this.issueTokenPair(user);
    await this.refreshRepo.revoke(existing.id);
    return next;
  }

  async revokeRefreshToken(presented: string): Promise<void> {
    const hash = this.hashToken(presented);
    const existing = await this.refreshRepo.findActiveByHash(hash);
    if (existing) await this.refreshRepo.revoke(existing.id);
  }

  private generateRefreshToken(): { token: string; expiresAt: Date } {
    const token = randomBytes(48).toString('base64url');
    const ttlMs = this.parseDurationMs(this.config.getOrThrow<string>('jwt.refreshTtl'));
    return { token, expiresAt: new Date(Date.now() + ttlMs) };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationMs(value: string): number {
    const match = /^(\d+)\s*([smhdw]?)$/i.exec(value.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const factors: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
      '': 1000,
    };
    return n * (factors[unit] ?? 1000);
  }
}
