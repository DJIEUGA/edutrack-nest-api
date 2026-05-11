import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RoleResolverService } from './role-resolver.service';
import { UserRoleRepository } from '../infrastructure/user-role.repository';

const USER_ID   = 'bbbbbbbb-0000-0000-0000-000000000002';
const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

describe('RoleResolverService', () => {
  let service: RoleResolverService;
  let mockUserRolesRepo: any;

  const ownerRow = { id: 'role-1', userId: USER_ID, schoolId: SCHOOL_ID, role: 'owner' };
  const adminRow = { id: 'role-2', userId: USER_ID, schoolId: SCHOOL_ID, role: 'admin' };

  beforeEach(async () => {
    mockUserRolesRepo = {
      listByUserAndSchool: jest.fn(),
      listByUser: jest.fn(),
    };
    mockUserRolesRepo.listByUserAndSchool.mockResolvedValue([ownerRow]);
    mockUserRolesRepo.listByUser.mockResolvedValue([ownerRow, adminRow]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleResolverService,
        { provide: UserRoleRepository, useValue: mockUserRolesRepo },
      ],
    }).compile();

    service = module.get<RoleResolverService>(RoleResolverService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('listRolesForUser()', () => {
    it('should call listByUserAndSchool when schoolId is provided', async () => {
      await service.listRolesForUser(USER_ID, SCHOOL_ID);
      expect(mockUserRolesRepo.listByUserAndSchool).toHaveBeenCalledWith(USER_ID, SCHOOL_ID);
      expect(mockUserRolesRepo.listByUser).not.toHaveBeenCalled();
    });

    it('should call listByUser when no schoolId is provided', async () => {
      await service.listRolesForUser(USER_ID);
      expect(mockUserRolesRepo.listByUser).toHaveBeenCalledWith(USER_ID);
      expect(mockUserRolesRepo.listByUserAndSchool).not.toHaveBeenCalled();
    });

    it('should map role assignment rows to an array of UserRole strings', async () => {
      const result = await service.listRolesForUser(USER_ID, SCHOOL_ID);
      expect(result).toEqual(['owner']);
    });

    it('should return an empty array when no roles found', async () => {
      mockUserRolesRepo.listByUserAndSchool.mockResolvedValue([]);
      const result = await service.listRolesForUser(USER_ID, SCHOOL_ID);
      expect(result).toEqual([]);
    });

    it('should return multiple roles when the user holds multiple', async () => {
      mockUserRolesRepo.listByUserAndSchool.mockResolvedValue([ownerRow, adminRow]);
      const result = await service.listRolesForUser(USER_ID, SCHOOL_ID);
      expect(result).toEqual(['owner', 'admin']);
    });
  });

  describe('userHasRoleInSchool()', () => {
    it('should return true when the user holds one of the required roles', async () => {
      mockUserRolesRepo.listByUserAndSchool.mockResolvedValue([ownerRow]);
      const result = await service.userHasRoleInSchool(USER_ID, SCHOOL_ID, ['owner', 'admin']);
      expect(result).toBe(true);
    });

    it('should return false when user holds none of the required roles', async () => {
      mockUserRolesRepo.listByUserAndSchool.mockResolvedValue([ownerRow]);
      const result = await service.userHasRoleInSchool(USER_ID, SCHOOL_ID, ['student', 'guardian']);
      expect(result).toBe(false);
    });

    it('should return false when user has no roles', async () => {
      mockUserRolesRepo.listByUserAndSchool.mockResolvedValue([]);
      const result = await service.userHasRoleInSchool(USER_ID, SCHOOL_ID, ['owner']);
      expect(result).toBe(false);
    });
  });
});
