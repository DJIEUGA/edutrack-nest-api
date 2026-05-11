import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { ConflictError, NotFoundError } from '@common/errors/domain.errors';

const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID   = 'bbbbbbbb-0000-0000-0000-000000000002';
const ACTOR_ID  = 'cccccccc-0000-0000-0000-000000000003';

function buildDataSourceMock() {
  const manager: any = { query: jest.fn() };
  const dataSource: any = {
    query: jest.fn(),
    transaction: jest.fn().mockImplementation((cb: any) => cb(manager)),
  };
  return { dataSource, manager };
}

describe('UsersService', () => {
  let service: UsersService;
  let mockDs: any;
  let mockMgr: any;

  beforeEach(async () => {
    const { dataSource, manager } = buildDataSourceMock();
    mockDs = dataSource;
    mockMgr = manager;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: mockDs },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('findByEmail()', () => {
    it('should return the user row when found', async () => {
      const user = { id: USER_ID, email: 'u@e.com', passwordHash: 'hash', isActive: true };
      mockDs.query.mockResolvedValue([user]);
      const result = await service.findByEmail('u@e.com');
      expect(result).toEqual(user);
    });

    it('should return undefined when no user matches', async () => {
      mockDs.query.mockResolvedValue([]);
      const result = await service.findByEmail('nobody@e.com');
      expect(result).toBeUndefined();
    });

    it('should call dataSource.query with the email as a parameter', async () => {
      mockDs.query.mockResolvedValue([]);
      await service.findByEmail('test@e.com');
      expect(mockDs.query).toHaveBeenCalledWith(expect.any(String), ['test@e.com']);
    });
  });

  describe('getPasswordHash()', () => {
    it('should return the password hash string when user exists', async () => {
      mockDs.query.mockResolvedValue([{ passwordHash: 'stored-hash' }]);
      const result = await service.getPasswordHash(USER_ID);
      expect(result).toBe('stored-hash');
    });

    it('should return null when user does not exist', async () => {
      mockDs.query.mockResolvedValue([]);
      const result = await service.getPasswordHash(USER_ID);
      expect(result).toBeNull();
    });
  });

  describe('updatePasswordHash()', () => {
    it('should call dataSource.query with userId and new hash', async () => {
      mockDs.query.mockResolvedValue([]);
      await service.updatePasswordHash(USER_ID, 'new-hash');
      expect(mockDs.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), [USER_ID, 'new-hash']);
    });
  });

  describe('getById()', () => {
    it('should return the user when found', async () => {
      const user = { id: USER_ID, email: 'u@e.com', isActive: true };
      mockDs.query.mockResolvedValue([user]);
      const result = await service.getById(USER_ID);
      expect(result).toEqual(user);
    });

    it('should throw NotFoundError when no user matches', async () => {
      mockDs.query.mockResolvedValue([]);
      await expect(service.getById('unknown-id')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('listBySchool()', () => {
    it('should call dataSource.query with the schoolId', async () => {
      mockDs.query.mockResolvedValue([]);
      await service.listBySchool(SCHOOL_ID);
      expect(mockDs.query).toHaveBeenCalledWith(expect.any(String), [SCHOOL_ID]);
    });

    it('should return the rows from the query', async () => {
      const rows = [{ id: USER_ID, email: 'u@e.com', fullName: 'Test User', roles: [] }];
      mockDs.query.mockResolvedValue(rows);
      const result = await service.listBySchool(SCHOOL_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('searchInSchool()', () => {
    it('should call dataSource.query twice — items + count', async () => {
      mockDs.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
      await service.searchInSchool(SCHOOL_ID);
      expect(mockDs.query).toHaveBeenCalledTimes(2);
    });

    it('should pass null as query param when no search string provided', async () => {
      mockDs.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
      await service.searchInSchool(SCHOOL_ID);
      const firstCall = mockDs.query.mock.calls[0];
      expect(firstCall[1]).toContain(null);
    });

    it('should wrap the query string in % when query is provided', async () => {
      mockDs.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
      await service.searchInSchool(SCHOOL_ID, 'john');
      const firstCall = mockDs.query.mock.calls[0];
      expect(firstCall[1]).toContain('%john%');
    });

    it('should return items and meta with correct total/limit/offset', async () => {
      mockDs.query
        .mockResolvedValueOnce([{ id: USER_ID }])
        .mockResolvedValueOnce([{ total: 5 }]);
      const result = await service.searchInSchool(SCHOOL_ID, undefined, undefined, 10, 20);
      expect(result.meta).toEqual({ total: 5, limit: 10, offset: 20 });
    });
  });

  describe('getByIdInSchool()', () => {
    it('should return the user when found in the school', async () => {
      const user = { id: USER_ID, email: 'u@e.com', fullName: 'Test', roles: [] };
      mockDs.query.mockResolvedValue([user]);
      const result = await service.getByIdInSchool(USER_ID, SCHOOL_ID);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundError when user is not in that school', async () => {
      mockDs.query.mockResolvedValue([]);
      await expect(service.getByIdInSchool('unknown', SCHOOL_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('createInSchool()', () => {
    it('should create user, profile, membership, role, and audit log in a transaction', async () => {
      mockMgr.query
        .mockResolvedValueOnce([])                        // SELECT existing user (not found)
        .mockResolvedValueOnce([{ id: USER_ID }])         // INSERT users
        .mockResolvedValueOnce([])                        // INSERT profiles
        .mockResolvedValueOnce([])                        // INSERT school_memberships
        .mockResolvedValueOnce([])                        // INSERT user_roles
        .mockResolvedValueOnce([]);                       // INSERT audit_logs

      mockDs.query.mockResolvedValue([{ id: USER_ID, email: 'new@e.com', fullName: 'New', roles: [] }]);

      await service.createInSchool(ACTOR_ID, SCHOOL_ID, { email: 'new@e.com', fullName: 'New User', role: 'lecturer' });
      expect(mockMgr.query).toHaveBeenCalledTimes(6);
    });

    it('should throw ConflictError when user already belongs to the school', async () => {
      mockMgr.query
        .mockResolvedValueOnce([{ id: USER_ID }])   // existing user found
        .mockResolvedValueOnce([{ id: 'mem-1' }]);  // membership exists

      await expect(
        service.createInSchool(ACTOR_ID, SCHOOL_ID, { email: 'existing@e.com', fullName: 'X', role: 'admin' }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('should add an existing global user to the school without creating a new user', async () => {
      mockMgr.query
        .mockResolvedValueOnce([{ id: USER_ID }])  // existing user found
        .mockResolvedValueOnce([])                 // no membership in school
        .mockResolvedValueOnce([])                 // INSERT school_memberships
        .mockResolvedValueOnce([])                 // INSERT user_roles
        .mockResolvedValueOnce([]);                // INSERT audit_logs

      mockDs.query.mockResolvedValue([{ id: USER_ID, email: 'existing@e.com', fullName: 'Existing', roles: [] }]);

      await service.createInSchool(ACTOR_ID, SCHOOL_ID, { email: 'existing@e.com', fullName: 'Existing', role: 'lecturer' });
      // Existing user path: 5 manager calls (no INSERT users/profiles)
      expect(mockMgr.query).toHaveBeenCalledTimes(5);
    });
  });

  describe('updateInSchool()', () => {
    it('should update full_name and phone in the profiles table', async () => {
      mockMgr.query.mockResolvedValue([]);
      mockDs.query.mockResolvedValue([{ id: USER_ID, email: 'u@e.com', fullName: 'Updated', roles: [] }]);

      await service.updateInSchool(USER_ID, SCHOOL_ID, { fullName: 'Updated Name', phone: '123' });
      const profileUpdate = mockMgr.query.mock.calls.find((c: any) => (c[0] as string).includes('UPDATE profiles'));
      expect(profileUpdate).toBeDefined();
    });

    it('should update is_active when provided', async () => {
      mockMgr.query.mockResolvedValue([]);
      mockDs.query.mockResolvedValue([{ id: USER_ID, email: 'u@e.com', isActive: false, roles: [] }]);

      await service.updateInSchool(USER_ID, SCHOOL_ID, { isActive: false });
      const userUpdate = mockMgr.query.mock.calls.find((c: any) => (c[0] as string).includes('UPDATE users'));
      expect(userUpdate).toBeDefined();
    });
  });

  describe('removeFromSchool()', () => {
    it('should delete membership and insert audit log, returning { success: true }', async () => {
      mockMgr.query.mockResolvedValue([]);
      const result = await service.removeFromSchool(ACTOR_ID, USER_ID, SCHOOL_ID);
      expect(result).toEqual({ success: true });
      expect(mockMgr.query).toHaveBeenCalledTimes(2);
    });

    it('should call DELETE on school_memberships', async () => {
      mockMgr.query.mockResolvedValue([]);
      await service.removeFromSchool(ACTOR_ID, USER_ID, SCHOOL_ID);
      const deleteCall = mockMgr.query.mock.calls.find((c: any) => (c[0] as string).includes('DELETE FROM school_memberships'));
      expect(deleteCall).toBeDefined();
    });
  });

  describe('resetPassword()', () => {
    it('should call getByIdInSchool first to validate membership', async () => {
      mockDs.query.mockResolvedValue([{ id: USER_ID }]);
      mockMgr.query.mockResolvedValue([]);

      await service.resetPassword(ACTOR_ID, USER_ID, SCHOOL_ID, { password: 'newPass123' });
      expect(mockDs.query).toHaveBeenCalledTimes(1);
    });

    it('should update the password hash and insert audit log in a transaction', async () => {
      mockDs.query.mockResolvedValue([{ id: USER_ID }]);
      mockMgr.query.mockResolvedValue([]);

      const result = await service.resetPassword(ACTOR_ID, USER_ID, SCHOOL_ID, { password: 'newPass123' });
      expect(result).toEqual({ success: true });
      expect(mockMgr.query).toHaveBeenCalledTimes(2);
    });
  });
});
