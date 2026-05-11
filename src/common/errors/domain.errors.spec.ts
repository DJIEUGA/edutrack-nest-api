import { describe, it, expect } from '@jest/globals';
import {
  DomainError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
  TenantScopeError,
  InvalidStateTransitionError,
  SchedulingConflictError,
} from './domain.errors';

describe('DomainError subclasses', () => {
  describe('NotFoundError', () => {
    it('should be instanceof DomainError and Error', () => {
      const e = new NotFoundError('not found');
      expect(e).toBeInstanceOf(DomainError);
      expect(e).toBeInstanceOf(Error);
    });

    it('should carry code NOTFOUND', () => {
      expect(new NotFoundError('x').code).toBe('NOTFOUND');
    });

    it('should set message correctly', () => {
      expect(new NotFoundError('resource missing').message).toBe('resource missing');
    });

    it('should store details when provided', () => {
      const e = new NotFoundError('x', { id: '123' });
      expect(e.details).toEqual({ id: '123' });
    });

    it('should have details undefined when not provided', () => {
      expect(new NotFoundError('x').details).toBeUndefined();
    });

    it('should set name to NotFoundError', () => {
      expect(new NotFoundError('x').name).toBe('NotFoundError');
    });
  });

  describe('ConflictError', () => {
    it('should carry code CONFLICT', () => {
      expect(new ConflictError('conflict').code).toBe('CONFLICT');
    });

    it('should be instanceof DomainError', () => {
      expect(new ConflictError('x')).toBeInstanceOf(DomainError);
    });

    it('should set name to ConflictError', () => {
      expect(new ConflictError('x').name).toBe('ConflictError');
    });
  });

  describe('ValidationError', () => {
    it('should carry code VALIDATION', () => {
      expect(new ValidationError('bad input').code).toBe('VALIDATION');
    });

    it('should propagate details', () => {
      const e = new ValidationError('bad', { field: 'email' });
      expect(e.details).toEqual({ field: 'email' });
    });
  });

  describe('ForbiddenError', () => {
    it('should carry code FORBIDDEN', () => {
      expect(new ForbiddenError('forbidden').code).toBe('FORBIDDEN');
    });
  });

  describe('UnauthorizedError', () => {
    it('should carry code UNAUTHORIZED', () => {
      expect(new UnauthorizedError('unauthorized').code).toBe('UNAUTHORIZED');
    });
  });

  describe('TenantScopeError', () => {
    it('should carry code TENANTSCOPE', () => {
      expect(new TenantScopeError('tenant error').code).toBe('TENANTSCOPE');
    });
  });

  describe('InvalidStateTransitionError', () => {
    it('should carry code INVALIDSTATETRANSITION', () => {
      expect(new InvalidStateTransitionError('bad transition').code).toBe('INVALIDSTATETRANSITION');
    });
  });

  describe('SchedulingConflictError', () => {
    it('should carry code SCHEDULINGCONFLICT', () => {
      expect(new SchedulingConflictError('schedule conflict').code).toBe('SCHEDULINGCONFLICT');
    });
  });

  describe('details propagation (shared behaviour)', () => {
    it('should store undefined details when none are passed', () => {
      const errors = [
        new NotFoundError('x'),
        new ConflictError('x'),
        new ValidationError('x'),
        new ForbiddenError('x'),
        new UnauthorizedError('x'),
      ];
      for (const e of errors) {
        expect(e.details).toBeUndefined();
      }
    });

    it('should store provided details object unchanged', () => {
      const details = { key: 'value', count: 42 };
      expect(new NotFoundError('x', details).details).toEqual(details);
    });
  });
});
