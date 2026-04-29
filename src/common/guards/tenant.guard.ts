import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, TenantScopeError, UnauthorizedError } from '../errors/domain.errors';
import { TENANT_SCOPE_KEY, TenantScopeOptions } from '../decorators/tenant-scope.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { TenantMembershipService } from '@modules/roles/application/tenant-membership.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberships: TenantMembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<TenantScopeOptions | undefined>(
      TENANT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedError('Authentication required');

    const paramName = options.paramName ?? (options.level === 'school' ? 'schoolId' : 'organizationId');
    const tenantId = (request.params as Record<string, string>)?.[paramName];
    if (!tenantId) {
      throw new TenantScopeError(`Missing tenant identifier in path: ${paramName}`);
    }

    const allowed =
      options.level === 'school'
        ? await this.memberships.userBelongsToSchool(request.user.userId, tenantId)
        : await this.memberships.userBelongsToOrganization(request.user.userId, tenantId);

    if (!allowed) {
      throw new ForbiddenError('User is not a member of the requested tenant', {
        level: options.level,
        tenantId,
      });
    }
    return true;
  }
}
