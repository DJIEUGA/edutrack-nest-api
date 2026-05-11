import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { TenantMembershipService } from './tenant-membership.service';
import { OrganizationMembership } from '@modules/organizations/domain/organization-membership.entity';
import { SchoolMembership } from '@modules/schools/domain/school-membership.entity';
import { School } from '@modules/schools/domain/school.entity';

const USER_ID   = 'bbbbbbbb-0000-0000-0000-000000000002';
const SCHOOL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORG_ID    = 'oooooooo-0000-0000-0000-000000000099';

describe('TenantMembershipService', () => {
  let service: TenantMembershipService;
  let mockOrgMembershipRepo: any;
  let mockSchoolMembershipRepo: any;
  let mockSchoolRepo: any;

  const fakeSchool = { id: SCHOOL_ID, organizationId: ORG_ID, name: 'Test School' };

  beforeEach(async () => {
    mockOrgMembershipRepo = { count: jest.fn() };
    mockSchoolMembershipRepo = { count: jest.fn() };
    mockSchoolRepo = { findOne: jest.fn() };
    mockSchoolRepo.findOne.mockResolvedValue(fakeSchool);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMembershipService,
        { provide: getRepositoryToken(OrganizationMembership), useValue: mockOrgMembershipRepo },
        { provide: getRepositoryToken(SchoolMembership), useValue: mockSchoolMembershipRepo },
        { provide: getRepositoryToken(School), useValue: mockSchoolRepo },
      ],
    }).compile();

    service = module.get<TenantMembershipService>(TenantMembershipService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('userBelongsToOrganization()', () => {
    it('should return true when orgMembership count > 0', async () => {
      mockOrgMembershipRepo.count.mockResolvedValue(1);
      const result = await service.userBelongsToOrganization(USER_ID, ORG_ID);
      expect(result).toBe(true);
    });

    it('should return false when count is 0', async () => {
      mockOrgMembershipRepo.count.mockResolvedValue(0);
      const result = await service.userBelongsToOrganization(USER_ID, ORG_ID);
      expect(result).toBe(false);
    });

    it('should call orgMembership.count with the correct where clause', async () => {
      mockOrgMembershipRepo.count.mockResolvedValue(1);
      await service.userBelongsToOrganization(USER_ID, ORG_ID);
      expect(mockOrgMembershipRepo.count).toHaveBeenCalledWith({ where: { organizationId: ORG_ID, userId: USER_ID } });
    });
  });

  describe('userBelongsToSchool()', () => {
    it('should return true on direct school membership', async () => {
      mockSchoolMembershipRepo.count.mockResolvedValue(1);
      const result = await service.userBelongsToSchool(USER_ID, SCHOOL_ID);
      expect(result).toBe(true);
    });

    it('should check organization membership when direct membership count is 0', async () => {
      mockSchoolMembershipRepo.count.mockResolvedValue(0);
      mockOrgMembershipRepo.count.mockResolvedValue(1);
      const result = await service.userBelongsToSchool(USER_ID, SCHOOL_ID);
      expect(result).toBe(true);
      expect(mockOrgMembershipRepo.count).toHaveBeenCalled();
    });

    it('should return false when neither direct nor org membership exists', async () => {
      mockSchoolMembershipRepo.count.mockResolvedValue(0);
      mockOrgMembershipRepo.count.mockResolvedValue(0);
      const result = await service.userBelongsToSchool(USER_ID, SCHOOL_ID);
      expect(result).toBe(false);
    });

    it('should return false when school does not exist (skips org membership lookup)', async () => {
      mockSchoolMembershipRepo.count.mockResolvedValue(0);
      mockSchoolRepo.findOne.mockResolvedValue(null);
      const result = await service.userBelongsToSchool(USER_ID, SCHOOL_ID);
      expect(result).toBe(false);
      expect(mockOrgMembershipRepo.count).not.toHaveBeenCalled();
    });

    it('should use school.organizationId when checking org-level fallback', async () => {
      mockSchoolMembershipRepo.count.mockResolvedValue(0);
      mockOrgMembershipRepo.count.mockResolvedValue(1);
      await service.userBelongsToSchool(USER_ID, SCHOOL_ID);
      expect(mockOrgMembershipRepo.count).toHaveBeenCalledWith({ where: { organizationId: ORG_ID, userId: USER_ID } });
    });
  });
});
