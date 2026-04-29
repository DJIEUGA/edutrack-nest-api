import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '../errors/domain.errors';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { UserRole } from '../types/role.types';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleResolver: RoleResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedError('Authentication required');

    const schoolId = (request.params as Record<string, string>)?.schoolId;
    const userRoles = await this.roleResolver.listRolesForUser(request.user.userId, schoolId);

    if (!required.some((r) => userRoles.includes(r))) {
      throw new ForbiddenError('Insufficient role for this operation', { required, granted: userRoles });
    }
    return true;
  }
}
