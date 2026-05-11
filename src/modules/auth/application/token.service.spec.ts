import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { TokenService } from './token.service';
import { RefreshTokenRepository } from '../infrastructure/refresh-token.repository';
import { UnauthorizedError } from '@common/errors/domain.errors';

const FIXED_ACCESS_TOKEN = 'mock.access.token';
const REFRESH_TOKEN_HEX_RE = /^[0-9a-f]{64}$/;
const BASE64URL_RE = /^[A-Za-z0-9\-_]+$/;

describe('TokenService', () => {
  let service: TokenService;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRefreshRepo: any;

  beforeEach(async () => {
    mockJwtService = { signAsync: jest.fn() };
    mockJwtService.signAsync.mockResolvedValue(FIXED_ACCESS_TOKEN);

    mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'jwt.accessSecret': 'test-access-secret-32-chars-min!!',
          'jwt.accessTtl': '15m',
          'jwt.refreshTtl': '7d',
        };
        if (!(key in map)) throw new Error(`Missing config: ${key}`);
        return map[key];
      }),
      get: jest.fn().mockImplementation((key: string) =>
        ({ 'jwt.issuer': 'edutrack-test', 'jwt.audience': 'edutrack-api' } as Record<string, string>)[key],
      ),
    };

    mockRefreshRepo = {
      create: jest.fn(),
      findActiveByHash: jest.fn(),
      revoke: jest.fn(),
    };
    mockRefreshRepo.create.mockResolvedValue({ id: 'token-id', userId: 'user-1' });
    mockRefreshRepo.revoke.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RefreshTokenRepository, useValue: mockRefreshRepo },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  const user = { id: 'user-id-1', email: 'test@example.com' };

  describe('issueTokenPair()', () => {
    it('should call jwtService.signAsync with the correct payload', async () => {
      await service.issueTokenPair(user);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { sub: user.id, email: user.email },
        expect.objectContaining({ secret: 'test-access-secret-32-chars-min!!' }),
      );
    });

    it('should call refreshRepo.create with a 64-char hex tokenHash', async () => {
      await service.issueTokenPair(user);
      const createArg = mockRefreshRepo.create.mock.calls[0][0];
      expect(createArg.tokenHash).toMatch(REFRESH_TOKEN_HEX_RE);
    });

    it('should return all four fields', async () => {
      const pair = await service.issueTokenPair(user);
      expect(pair).toHaveProperty('accessToken');
      expect(pair).toHaveProperty('refreshToken');
      expect(pair).toHaveProperty('accessExpiresIn');
      expect(pair).toHaveProperty('refreshExpiresIn');
    });

    it('should return the mocked accessToken', async () => {
      const pair = await service.issueTokenPair(user);
      expect(pair.accessToken).toBe(FIXED_ACCESS_TOKEN);
    });

    it('should return accessExpiresIn and refreshExpiresIn from config', async () => {
      const pair = await service.issueTokenPair(user);
      expect(pair.accessExpiresIn).toBe('15m');
      expect(pair.refreshExpiresIn).toBe('7d');
    });

    it('the returned refreshToken should be base64url encoded', async () => {
      const pair = await service.issueTokenPair(user);
      expect(pair.refreshToken).toMatch(BASE64URL_RE);
    });

    it('the stored tokenHash should differ from the raw refreshToken', async () => {
      const pair = await service.issueTokenPair(user);
      const createArg = mockRefreshRepo.create.mock.calls[0][0];
      expect(createArg.tokenHash).not.toBe(pair.refreshToken);
    });

    it('should store a future expiresAt in the refresh token record', async () => {
      const before = Date.now();
      await service.issueTokenPair(user);
      const createArg = mockRefreshRepo.create.mock.calls[0][0];
      expect(createArg.expiresAt.getTime()).toBeGreaterThan(before);
    });

    it('should store expiresAt ≈ now + 7 days for "7d" TTL', async () => {
      const before = Date.now();
      await service.issueTokenPair(user);
      const createArg = mockRefreshRepo.create.mock.calls[0][0];
      const expectedMs = 7 * 24 * 60 * 60 * 1000;
      expect(createArg.expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
      expect(createArg.expiresAt.getTime()).toBeLessThanOrEqual(before + expectedMs + 1000);
    });
  });

  describe('resolveActiveRefreshToken()', () => {
    it('should return {id, userId, expiresAt} for a valid non-expired token', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      mockRefreshRepo.findActiveByHash.mockResolvedValue({ id: 'tok-1', userId: 'user-id-1', expiresAt: futureDate });

      const result = await service.resolveActiveRefreshToken('some-raw-token');
      expect(result).toEqual({ id: 'tok-1', userId: 'user-id-1', expiresAt: futureDate });
    });

    it('should throw UnauthorizedError when no active token found by hash', async () => {
      mockRefreshRepo.findActiveByHash.mockResolvedValue(null);
      await expect(service.resolveActiveRefreshToken('bad-token')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('should throw UnauthorizedError and call revoke when the token is expired', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockRefreshRepo.findActiveByHash.mockResolvedValue({ id: 'tok-expired', userId: 'user-id-1', expiresAt: pastDate });

      await expect(service.resolveActiveRefreshToken('expired-token')).rejects.toBeInstanceOf(UnauthorizedError);
      expect(mockRefreshRepo.revoke).toHaveBeenCalledWith('tok-expired');
    });

    it('should hash the presented token before querying the repository', async () => {
      mockRefreshRepo.findActiveByHash.mockResolvedValue(null);
      const rawToken = 'my-raw-refresh-token';
      await service.resolveActiveRefreshToken(rawToken).catch(() => {});
      const passedHash = mockRefreshRepo.findActiveByHash.mock.calls[0][0] as string;
      expect(passedHash).toMatch(REFRESH_TOKEN_HEX_RE);
      expect(passedHash).not.toBe(rawToken);
    });
  });

  describe('rotateRefreshToken()', () => {
    it('should issue a new token pair and revoke the old token', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      mockRefreshRepo.findActiveByHash.mockResolvedValue({ id: 'old-tok', userId: user.id, expiresAt: futureDate });

      const pair = await service.rotateRefreshToken('old-raw-token', user);
      expect(pair).toHaveProperty('accessToken');
      expect(mockRefreshRepo.revoke).toHaveBeenCalledWith('old-tok');
    });

    it('should throw UnauthorizedError when userId on the token mismatches the provided user', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      mockRefreshRepo.findActiveByHash.mockResolvedValue({ id: 'tok-1', userId: 'different-user-id', expiresAt: futureDate });

      await expect(service.rotateRefreshToken('token', user)).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('revokeRefreshToken()', () => {
    it('should call refreshRepo.revoke when an active token is found', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      mockRefreshRepo.findActiveByHash.mockResolvedValue({ id: 'tok-abc', userId: 'user-1', expiresAt: futureDate });

      await service.revokeRefreshToken('some-raw-token');
      expect(mockRefreshRepo.revoke).toHaveBeenCalledWith('tok-abc');
    });

    it('should not throw when no active token is found (idempotent)', async () => {
      mockRefreshRepo.findActiveByHash.mockResolvedValue(null);
      await expect(service.revokeRefreshToken('unknown-token')).resolves.toBeUndefined();
    });
  });

  describe('parseDurationMs (tested via expiresAt in issueTokenPair)', () => {
    async function getExpiresAtMs(ttl: string): Promise<number> {
      mockConfigService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'jwt.accessSecret') return 'test-secret-min-32-chars-padding!!';
        if (key === 'jwt.accessTtl') return '15m';
        if (key === 'jwt.refreshTtl') return ttl;
        throw new Error(`Missing: ${key}`);
      });
      const before = Date.now();
      await service.issueTokenPair(user);
      const calls = mockRefreshRepo.create.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      return lastCall.expiresAt.getTime() - before;
    }

    it('should parse "30s" as ~30_000 ms', async () => {
      const ms = await getExpiresAtMs('30s');
      expect(ms).toBeGreaterThanOrEqual(29_000);
      expect(ms).toBeLessThanOrEqual(31_000);
    });

    it('should parse "1h" as ~3_600_000 ms', async () => {
      const ms = await getExpiresAtMs('1h');
      expect(ms).toBeGreaterThanOrEqual(3_599_000);
      expect(ms).toBeLessThanOrEqual(3_601_000);
    });

    it('should parse "1w" as ~604_800_000 ms', async () => {
      const ms = await getExpiresAtMs('1w');
      expect(ms).toBeGreaterThanOrEqual(604_799_000);
      expect(ms).toBeLessThanOrEqual(604_801_000);
    });

    it('should default to 7 days for an unrecognized format', async () => {
      const ms = await getExpiresAtMs('bad-format');
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(ms).toBeGreaterThanOrEqual(sevenDays - 1000);
      expect(ms).toBeLessThanOrEqual(sevenDays + 1000);
    });
  });
});
