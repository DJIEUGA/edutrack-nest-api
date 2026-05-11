import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedError, ValidationError } from '@common/errors/domain.errors';
import { UsersService } from '@modules/users/application/users.service';
import { TokenPair, TokenService } from './token.service';

const TIMING_DUMMY_HASH = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.users.findByEmail(email);
    // Always run bcrypt against a dummy hash on miss to avoid user-existence timing leaks.
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? TIMING_DUMMY_HASH);
    if (!user || !user.isActive || !passwordOk) {
      throw new UnauthorizedError('Invalid email or password');
    }
    return this.tokens.issueTokenPair({ id: user.id, email: user.email });
  }

  async refresh(presentedToken: string): Promise<TokenPair> {
    const active = await this.tokens.resolveActiveRefreshToken(presentedToken);
    const user = await this.users.getById(active.userId);
    if (!user.isActive) throw new UnauthorizedError('Account is inactive');
    return this.tokens.rotateRefreshToken(presentedToken, { id: user.id, email: user.email });
  }

  async logout(presentedToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(presentedToken);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const hash = await this.users.getPasswordHash(userId);
    const valid = await bcrypt.compare(currentPassword, hash ?? '');
    if (!valid) throw new ValidationError('Current password is incorrect');
    const newHash = await bcrypt.hash(newPassword, 10);
    await this.users.updatePasswordHash(userId, newHash);
  }
}
