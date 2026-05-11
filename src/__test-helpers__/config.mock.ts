import { jest } from '@jest/globals';

const CONFIG_MAP: Record<string, string> = {
  'jwt.accessSecret': 'test-access-secret-32-chars-min!!',
  'jwt.accessTtl': '15m',
  'jwt.refreshTtl': '7d',
};

const OPTIONAL_MAP: Record<string, string> = {
  'jwt.issuer': 'edutrack-test',
  'jwt.audience': 'edutrack-api',
};

export const mockConfigService = {
  getOrThrow: jest.fn().mockImplementation((key: string) => {
    if (!(key in CONFIG_MAP)) throw new Error(`Missing config: ${key}`);
    return CONFIG_MAP[key];
  }),
  get: jest.fn().mockImplementation((key: string) => OPTIONAL_MAP[key]),
};

export const IDS = {
  SCHOOL:  'aaaaaaaa-0000-0000-0000-000000000001',
  USER:    'bbbbbbbb-0000-0000-0000-000000000002',
  YEAR:    'cccccccc-0000-0000-0000-000000000003',
  CLASS:   'dddddddd-0000-0000-0000-000000000004',
  SESSION: 'eeeeeeee-0000-0000-0000-000000000005',
  STUDENT: 'ffffffff-0000-0000-0000-000000000006',
};
