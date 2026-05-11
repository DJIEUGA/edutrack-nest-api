/**
 * Domain-layer errors thrown by application services. The global exception
 * filter maps these to HTTP responses; controllers never throw HTTP errors
 * directly so the domain stays transport-agnostic.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOTFOUND';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

export class TenantScopeError extends DomainError {
  readonly code = 'TENANTSCOPE';
}

export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALIDSTATETRANSITION';
}

export class SchedulingConflictError extends DomainError {
  readonly code = 'SCHEDULINGCONFLICT';
}
