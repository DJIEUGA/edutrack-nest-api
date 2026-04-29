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
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

export class TenantScopeError extends DomainError {
  readonly code = 'TENANT_SCOPE_VIOLATION';
}

export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION';
}

export class SchedulingConflictError extends DomainError {
  readonly code = 'SCHEDULING_CONFLICT';
}
