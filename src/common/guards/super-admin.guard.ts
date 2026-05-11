import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard to restrict access to System Global Administration routes.
 * Checks for a specific global role or 'isSystemAdmin' flag on the user object.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Ensure user is authenticated and has the global admin flag
    // This flag should only be settable via direct DB access or by another Super Admin
    if (!user || !user.isSystemAdmin) {
      throw new ForbiddenException('Access denied: System Administrator privileges required.');
    }

    return true;
  }
}