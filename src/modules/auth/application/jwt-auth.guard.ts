import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Standard JWT authentication guard that leverages Passport's JWT strategy.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}