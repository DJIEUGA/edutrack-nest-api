import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by RolesGuard to identify required permissions.
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to require specific permissions for a route.
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);