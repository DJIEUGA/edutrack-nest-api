import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UnauthorizedError } from '@common/errors/domain.errors';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { UsersService } from '@modules/users/application/users.service';
import { JwtPayload } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
      issuer: config.get<string>('jwt.issuer'),
      audience: config.get<string>('jwt.audience'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findByEmail(payload.email);
    if (!user || user.id !== payload.sub || !user.isActive) {
      throw new UnauthorizedError('Authentication failed');
    }
    return { userId: user.id, email: user.email, isSystemAdmin: user.isSystemAdmin ?? false };
  }
}
