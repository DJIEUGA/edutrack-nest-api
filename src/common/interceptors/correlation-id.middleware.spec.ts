import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildContext(headerValue?: string | string[]) {
  const req: any = { headers: {} };
  if (headerValue !== undefined) req.headers['x-request-id'] = headerValue;

  const res: any = { setHeader: jest.fn() };
  const next: any = jest.fn();
  return { req, res, next };
}

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should call next()', () => {
    const { req, res, next } = buildContext();
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should generate a UUID v4 and attach it to req.correlationId when no header is present', () => {
    const { req, res, next } = buildContext();
    middleware.use(req, res, next);
    expect(req.correlationId).toMatch(UUID_V4_RE);
  });

  it('should set x-request-id response header to the generated / incoming ID', () => {
    const { req, res, next } = buildContext();
    middleware.use(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.correlationId);
  });

  it('should use the incoming x-request-id when it is a valid non-empty string ≤ 128 chars', () => {
    const incoming = 'my-custom-request-id';
    const { req, res, next } = buildContext(incoming);
    middleware.use(req, res, next);
    expect(req.correlationId).toBe(incoming);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', incoming);
  });

  it('should echo the incoming x-request-id back in the response header', () => {
    const incoming = 'echo-this-id';
    const { req, res, next } = buildContext(incoming);
    middleware.use(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', incoming);
  });

  it('should generate a new UUID when x-request-id is an empty string', () => {
    const { req, res, next } = buildContext('');
    middleware.use(req, res, next);
    expect(req.correlationId).toMatch(UUID_V4_RE);
  });

  it('should generate a new UUID when x-request-id exceeds 128 characters', () => {
    const longId = 'a'.repeat(129);
    const { req, res, next } = buildContext(longId);
    middleware.use(req, res, next);
    expect(req.correlationId).toMatch(UUID_V4_RE);
    expect(req.correlationId).not.toBe(longId);
  });

  it('should generate a new UUID when x-request-id is an array (multi-value header)', () => {
    const { req, res, next } = buildContext(['id-one', 'id-two']);
    middleware.use(req, res, next);
    expect(req.correlationId).toMatch(UUID_V4_RE);
  });

  it('should generate different UUIDs on successive calls without an incoming header', () => {
    const ids = [1, 2, 3].map(() => {
      const { req, res, next } = buildContext();
      middleware.use(req, res, next);
      return req.correlationId;
    });
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });

  it('generated UUID should match the v4 format regex', () => {
    const { req, res, next } = buildContext();
    middleware.use(req, res, next);
    expect(req.correlationId).toMatch(UUID_V4_RE);
  });
});
