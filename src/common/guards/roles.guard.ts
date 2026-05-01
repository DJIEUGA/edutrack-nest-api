import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '../errors/domain.errors';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { UserRole } from '../types/role.types';
import { RoleResolverService } from '@modules/roles/application/role-resolver.service';
import { PermissionsService } from '@modules/roles/application/permissions.service';
import { hasCapability } from '@modules/roles/domain/role-capabilities';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleResolver: RoleResolverService,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPerms = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!required || required.length === 0) && (!requiredPerms || requiredPerms.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedError('Authentication required');

    const schoolId = (request.params as Record<string, string>)?.schoolId;

    // Validate UUID format to prevent database 500 errors from malformed path parameters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (schoolId && !uuidRegex.test(schoolId)) {
      throw new ForbiddenError('Invalid school context: ID must be a valid UUID');
    }

    const userRoles = await this.roleResolver.listRolesForUser(request.user.userId, schoolId);
    // This now aggregates direct user permissions AND permissions from their dynamic roles
    const userDirectPerms = await this.permissions.listUserPermissions(request.user.userId, schoolId);

    // 1. Role-based access check (backward compatibility)
    if (required?.some((r) => userRoles.includes(r))) {
      return true;
    }

    // 2. Permission-based access check (checks both roles' capabilities and direct perms)
    if (requiredPerms && requiredPerms.length > 0) {
      const hasAnyPerm = requiredPerms.some((req) => {
        // Check if any role has the capability mapping
        if (userRoles.some((role) => hasCapability(role, req))) return true;
        // Check direct dynamic permissions
        return userDirectPerms.includes(req) || userDirectPerms.includes(`${req.split(':')[0]}:*`);
      });

      if (hasAnyPerm) return true;
    }

    if (required && required.length > 0) {
      throw new ForbiddenError('Insufficient role for this operation', { required, granted: userRoles });
    }

    throw new ForbiddenError('Insufficient permissions for this operation', { 
      required: requiredPerms, 
      granted: userDirectPerms 
    });
  }
}
