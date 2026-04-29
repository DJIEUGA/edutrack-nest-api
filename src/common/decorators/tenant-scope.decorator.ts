import { SetMetadata } from '@nestjs/common';

export type TenantScopeLevel = 'organization' | 'school';

export interface TenantScopeOptions {
  level: TenantScopeLevel;
  paramName?: string;
}

export const TENANT_SCOPE_KEY = 'tenantScope';

/**
 * Marks a route as tenant-scoped. The matching guard validates the JWT user has
 * membership in the organization/school identified by the route param.
 */
export const TenantScope = (options: TenantScopeOptions) =>
  SetMetadata(TENANT_SCOPE_KEY, options);
