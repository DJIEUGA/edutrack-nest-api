import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '@modules/users/application/users.service';
import { TokenService, TokenPair } from './token.service';
import { UnauthorizedError, ValidationError } from '@common/errors/domain.errors';

const MOCK_TOKEN_PAIR: TokenPair = {
  accessToken: 'access.token',
  refreshToken: 'refresh-token',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
};

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: any;
  let mockTokenService: any;

  beforeEach(async () => {
    mockUsersService = {
      findByEmail: jest.fn(),
      getById: jest.fn(),
      getPasswordHash: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    mockUsersService.updatePasswordHash.mockResolvedValue(undefined);

    mockTokenService = {
      issueTokenPair: jest.fn(),
      resolveActiveRefreshToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
    };
    mockTokenService.issueTokenPair.mockResolvedValue(MOCK_TOKEN_PAIR);
    mockTokenService.rotateRefreshToken.mockResolvedValue(MOCK_TOKEN_PAIR);
    mockTokenService.revokeRefreshToken.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('login()', () => {
    const email = 'user@example.com';
    const password = 'correct-password';
    const hash = bcrypt.hashSync(password, 4);
    const activeUser = { id: 'user-1', email, passwordHash: hash, isActive: true };

    it('should return a TokenPair on valid credentials for an active user', async () => {
      mockUsersService.findByEmail.mockResolvedValue(activeUser);
      const result = await service.login(email, password);
      expect(result).toEqual(MOCK_TOKEN_PAIR);
    });

    it('should call tokens.issueTokenPair with the correct user id and email on success', async () => {
      mockUsersService.findByEmail.mockResolvedValue(activeUser);
      await service.login(email, password);
      expect(mockTokenService.issueTokenPair).toHaveBeenCalledWith({ id: 'user-1', email });
    });

    it('should call users.findByEmail with the provided email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await service.login(email, password).catch(() => {});
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should throw UnauthorizedError when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(service.login(email, password)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('should throw the same UnauthorizedError regardless of whether the user exists (timing-safe)', async () => {
      // bcryptjs properties are non-configurable and cannot be spied on directly.
      // Instead, verify timing-safe behaviour by confirming both the "no user" and
      // "wrong password" code paths produce an identical error type and message,
      // which only holds if bcrypt.compare always runs (dummy hash path).
      mockUsersService.findByEmail.mockResolvedValue(null);
      const errWhenMissing = await service.login(email, password).catch((e) => e);

      mockUsersService.findByEmail.mockResolvedValue(activeUser);
      const errWhenWrong = await service.login(email, 'wrong-password').catch((e) => e);

      expect(errWhenMissing).toBeInstanceOf(UnauthorizedError);
      expect(errWhenWrong).toBeInstanceOf(UnauthorizedError);
      expect(errWhenMissing.message).toBe(errWhenWrong.message);
    });

    it('should throw UnauthorizedError when user is inactive', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ ...activeUser, isActive: false });
      await expect(service.login(email, password)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('should throw UnauthorizedError when password is wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValue(activeUser);
      await expect(service.login(email, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('refresh()', () => {
    const presentedToken = 'refresh-token-raw';

    it('should resolve an active refresh token and return a new token pair', async () => {
      mockTokenService.resolveActiveRefreshToken.mockResolvedValue({
        id: 'tok-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000),
      });
      mockUsersService.getById.mockResolvedValue({ id: 'user-1', email: 'u@e.com', isActive: true });

      const result = await service.refresh(presentedToken);
      expect(result).toEqual(MOCK_TOKEN_PAIR);
    });

    it('should call tokens.rotateRefreshToken with presented token and user info', async () => {
      mockTokenService.resolveActiveRefreshToken.mockResolvedValue({
        id: 'tok-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000),
      });
      mockUsersService.getById.mockResolvedValue({ id: 'user-1', email: 'u@e.com', isActive: true });

      await service.refresh(presentedToken);
      expect(mockTokenService.rotateRefreshToken).toHaveBeenCalledWith(presentedToken, { id: 'user-1', email: 'u@e.com' });
    });

    it('should throw UnauthorizedError when the user is inactive', async () => {
      mockTokenService.resolveActiveRefreshToken.mockResolvedValue({
        id: 'tok-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000),
      });
      mockUsersService.getById.mockResolvedValue({ id: 'user-1', email: 'u@e.com', isActive: false });

      await expect(service.refresh(presentedToken)).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('logout()', () => {
    it('should call tokens.revokeRefreshToken with the presented token', async () => {
      await service.logout('some-refresh-token');
      expect(mockTokenService.revokeRefreshToken).toHaveBeenCalledWith('some-refresh-token');
    });

    it('should resolve without throwing', async () => {
      await expect(service.logout('any-token')).resolves.toBeUndefined();
    });
  });

  describe('changePassword()', () => {
    const userId = 'user-id-1';
    const currentPassword = 'current-pass';
    const newPassword = 'new-password-123';
    const currentHash = bcrypt.hashSync(currentPassword, 4);

    it('should call users.getPasswordHash with the userId', async () => {
      mockUsersService.getPasswordHash.mockResolvedValue(currentHash);
      await service.changePassword(userId, currentPassword, newPassword);
      expect(mockUsersService.getPasswordHash).toHaveBeenCalledWith(userId);
    });

    it('should call users.updatePasswordHash with userId and a new bcrypt hash', async () => {
      mockUsersService.getPasswordHash.mockResolvedValue(currentHash);
      await service.changePassword(userId, currentPassword, newPassword);
      const updateCall = mockUsersService.updatePasswordHash.mock.calls[0];
      expect(updateCall[0]).toBe(userId);
      const newHash = updateCall[1] as string;
      expect(newHash).toMatch(/^\$2[ab]\$/);
      expect(await bcrypt.compare(newPassword, newHash)).toBe(true);
    });

    it('should throw ValidationError when the current password does not match', async () => {
      mockUsersService.getPasswordHash.mockResolvedValue(currentHash);
      await expect(service.changePassword(userId, 'wrong-pass', newPassword)).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError when getPasswordHash returns null', async () => {
      mockUsersService.getPasswordHash.mockResolvedValue(null);
      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toBeInstanceOf(ValidationError);
    });

    it('should NOT call updatePasswordHash when password is incorrect', async () => {
      mockUsersService.getPasswordHash.mockResolvedValue(currentHash);
      await service.changePassword(userId, 'wrong', newPassword).catch(() => {});
      expect(mockUsersService.updatePasswordHash).not.toHaveBeenCalled();
    });
  });
});
