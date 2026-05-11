import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from './global-exception.filter';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
} from '../errors/domain.errors';

function buildMockHost(overrides: { correlationId?: string; xRequestId?: string } = {}) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = {
    correlationId: overrides.correlationId,
    headers: { 'x-request-id': overrides.xRequestId },
  };
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any,
    response,
  };
}

function buildQueryFailedError(pgCode: string): QueryFailedError {
  const err = new QueryFailedError('SELECT 1', [], { code: pgCode } as any);
  return err;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  describe('HttpException handling', () => {
    it('should return the HttpException status code', () => {
      const { host, response } = buildMockHost();
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);
      expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should extract message from the exception', () => {
      const { host, response } = buildMockHost();
      filter.catch(new HttpException('Custom message', HttpStatus.FORBIDDEN), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.message).toBe('Custom message');
    });

    it('should set code to HTTP_ERROR for a generic HttpException', () => {
      const { host, response } = buildMockHost();
      filter.catch(new HttpException('err', HttpStatus.INTERNAL_SERVER_ERROR), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('HTTP_ERROR');
    });

    it('should set code to VALIDATION_ERROR and build details map for 400 with array messages', () => {
      const { host, response } = buildMockHost();
      const exc = new HttpException(
        { statusCode: 400, message: ['email must be valid', 'password is too short'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(exc, host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('email must be valid');
      expect(body.error.details).toHaveProperty('email');
    });

    it('should set code to VALIDATION_ERROR for 422 UnprocessableEntity', () => {
      const { host, response } = buildMockHost();
      const exc = new HttpException(
        { statusCode: 422, message: ['field required'], error: 'Unprocessable Entity' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      filter.catch(exc, host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should use the first element of array message as the top-level message string', () => {
      const { host, response } = buildMockHost();
      const exc = new HttpException(
        { message: ['first error', 'second error'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(exc, host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.message).toBe('first error');
    });
  });

  describe('QueryFailedError handling', () => {
    it('should map driverError code 23505 to CONFLICT / 400', () => {
      const { host, response } = buildMockHost();
      filter.catch(buildQueryFailedError('23505'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should map driverError code 23502 to VALIDATION / 400', () => {
      const { host, response } = buildMockHost();
      filter.catch(buildQueryFailedError('23502'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('VALIDATION');
    });

    it('should map driverError code 42703 to SCHEMA_MISMATCH / 400', () => {
      const { host, response } = buildMockHost();
      filter.catch(buildQueryFailedError('42703'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('SCHEMA_MISMATCH');
    });

    it('should map driverError code 42P01 to SCHEMA_MISMATCH / 400', () => {
      const { host, response } = buildMockHost();
      filter.catch(buildQueryFailedError('42P01'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('SCHEMA_MISMATCH');
    });

    it('should map driverError code 42883 to TYPE_MISMATCH / 400', () => {
      const { host, response } = buildMockHost();
      filter.catch(buildQueryFailedError('42883'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('TYPE_MISMATCH');
    });

    it('should map an unknown driverError code to DATABASE_ERROR / 400', () => {
      const { host, response } = buildMockHost();
      filter.catch(buildQueryFailedError('99999'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('DomainError handling', () => {
    it('should map NotFoundError to 400 with code NOTFOUND', () => {
      const { host, response } = buildMockHost();
      filter.catch(new NotFoundError('not found'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(body.error.code).toBe('NOTFOUND');
      expect(body.message).toBe('not found');
    });

    it('should map ConflictError to 400 with code CONFLICT', () => {
      const { host, response } = buildMockHost();
      filter.catch(new ConflictError('conflict'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should map ValidationError to 400 with code VALIDATION', () => {
      const { host, response } = buildMockHost();
      filter.catch(new ValidationError('invalid'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('VALIDATION');
    });

    it('should map ForbiddenError to 400 with code FORBIDDEN', () => {
      const { host, response } = buildMockHost();
      filter.catch(new ForbiddenError('forbidden'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should map UnauthorizedError to 400 with code UNAUTHORIZED', () => {
      const { host, response } = buildMockHost();
      filter.catch(new UnauthorizedError('unauthorized'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should include details from DomainError in the response', () => {
      const { host, response } = buildMockHost();
      filter.catch(new NotFoundError('not found', { id: 'abc' }), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.details).toEqual({ id: 'abc' });
    });
  });

  describe('Unhandled exception handling', () => {
    it('should return 500 for a plain Error', () => {
      const { host, response } = buildMockHost();
      filter.catch(new Error('unexpected'), host);
      expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should set success: false for unhandled exception', () => {
      const { host, response } = buildMockHost();
      filter.catch(new Error('boom'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.success).toBe(false);
    });
  });

  describe('Response shape', () => {
    it('should always include success: false', () => {
      const { host, response } = buildMockHost();
      filter.catch(new NotFoundError('x'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.success).toBe(false);
    });

    it('should always include a timestamp ISO string', () => {
      const { host, response } = buildMockHost();
      filter.catch(new NotFoundError('x'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(typeof body.timestamp).toBe('string');
      expect(() => new Date(body.timestamp)).not.toThrow();
    });

    it('should use correlationId from request when present', () => {
      const { host, response } = buildMockHost({ correlationId: 'test-corr-id' });
      filter.catch(new NotFoundError('x'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.requestId).toBe('test-corr-id');
    });

    it('should fall back to x-request-id header when correlationId is absent', () => {
      const { host, response } = buildMockHost({ xRequestId: 'header-req-id' });
      filter.catch(new NotFoundError('x'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.requestId).toBe('header-req-id');
    });

    it('should use req_unknown when neither correlationId nor header is present', () => {
      const { host, response } = buildMockHost();
      filter.catch(new NotFoundError('x'), host);
      const body = (response.json as any).mock.calls[0][0];
      expect(body.requestId).toBe('req_unknown');
    });
  });
});
