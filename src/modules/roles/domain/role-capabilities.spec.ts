import { describe, it, expect } from '@jest/globals';
import { ROLE_CAPABILITIES, hasCapability } from './role-capabilities';
import { UserRole } from '@common/types/role.types';

const ALL_ROLES: UserRole[] = ['owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian', 'follower'];

describe('ROLE_CAPABILITIES map', () => {
  it('should define capabilities for all 8 UserRole values', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_CAPABILITIES[role]).toBeDefined();
    }
  });

  it('all capability sets should be Set instances', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_CAPABILITIES[role]).toBeInstanceOf(Set);
    }
  });
});

describe('hasCapability()', () => {
  describe('owner role', () => {
    it('should satisfy academic:read via wildcard academic:*', () => {
      expect(hasCapability('owner', 'academic:read')).toBe(true);
    });

    it('should satisfy school:delete via wildcard school:*', () => {
      expect(hasCapability('owner', 'school:delete')).toBe(true);
    });

    it('should satisfy audit:read (exact match)', () => {
      expect(hasCapability('owner', 'audit:read')).toBe(true);
    });

    it('should satisfy organization:update via organization:*', () => {
      expect(hasCapability('owner', 'organization:update')).toBe(true);
    });
  });

  describe('admin role', () => {
    it('should satisfy academic:write via academic:*', () => {
      expect(hasCapability('admin', 'academic:write')).toBe(true);
    });

    it('should NOT satisfy organization:delete (no organization:* wildcard)', () => {
      expect(hasCapability('admin', 'organization:delete')).toBe(false);
    });

    it('should satisfy audit:read (exact match)', () => {
      expect(hasCapability('admin', 'audit:read')).toBe(true);
    });
  });

  describe('director role', () => {
    it('should satisfy school:read (exact match)', () => {
      expect(hasCapability('director', 'school:read')).toBe(true);
    });

    it('should NOT satisfy school:update', () => {
      expect(hasCapability('director', 'school:update')).toBe(false);
    });

    it('should satisfy academic:read (exact match)', () => {
      expect(hasCapability('director', 'academic:read')).toBe(true);
    });
  });

  describe('hod role', () => {
    it('should satisfy timetable:write (exact match)', () => {
      expect(hasCapability('hod', 'timetable:write')).toBe(true);
    });

    it('should NOT satisfy attendance:mark', () => {
      expect(hasCapability('hod', 'attendance:mark')).toBe(false);
    });
  });

  describe('lecturer role', () => {
    it('should satisfy session:start (exact match)', () => {
      expect(hasCapability('lecturer', 'session:start')).toBe(true);
    });

    it('should satisfy attendance:mark (exact match)', () => {
      expect(hasCapability('lecturer', 'attendance:mark')).toBe(true);
    });

    it('should NOT satisfy session:override-conflict', () => {
      expect(hasCapability('lecturer', 'session:override-conflict')).toBe(false);
    });
  });

  describe('student role', () => {
    it('should satisfy timetable:read-own (exact match)', () => {
      expect(hasCapability('student', 'timetable:read-own')).toBe(true);
    });

    it('should NOT satisfy attendance:mark', () => {
      expect(hasCapability('student', 'attendance:mark')).toBe(false);
    });

    it('should NOT satisfy school:update', () => {
      expect(hasCapability('student', 'school:update')).toBe(false);
    });
  });

  describe('guardian role', () => {
    it('should satisfy attendance:read-ward (exact match)', () => {
      expect(hasCapability('guardian', 'attendance:read-ward')).toBe(true);
    });

    it('should NOT satisfy attendance:mark', () => {
      expect(hasCapability('guardian', 'attendance:mark')).toBe(false);
    });
  });

  describe('follower role', () => {
    it('should satisfy organization:read (exact match)', () => {
      expect(hasCapability('follower', 'organization:read')).toBe(true);
    });

    it('should NOT satisfy academic:read', () => {
      expect(hasCapability('follower', 'academic:read')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for an unrecognized capability on a valid role', () => {
      expect(hasCapability('owner', 'nonexistent:action')).toBe(false);
    });

    it('should return false for an unrecognized role', () => {
      expect(hasCapability('superadmin' as any, 'academic:read')).toBe(false);
    });

    it('should not match a wildcard if the domain does not match', () => {
      // owner has school:*, not session:*... wait owner has session:*
      // hod has timetable:read and timetable:write but NOT timetable:*
      // Test that timetable:delete does NOT match for hod
      expect(hasCapability('hod', 'timetable:delete')).toBe(false);
    });
  });
});
