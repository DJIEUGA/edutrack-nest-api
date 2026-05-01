import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Marks a route as requiring specific dynamic permissions or role capabilities.
 * The RolesGuard checks both static role-to-capability mappings and direct
 * user_permissions assignments.
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);