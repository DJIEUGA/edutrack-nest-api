import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SchoolCreatedListener } from './school-created.listener';
import { PermissionsService } from './permissions.service';
import { SchoolCreatedEvent } from './school-created.event';
import { Logger } from '@nestjs/common';

describe('SchoolCreatedListener', () => {
  let listener: SchoolCreatedListener;
  let permissionsService: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolCreatedListener,
        {
          provide: PermissionsService,
          useValue: (() => {
            const svc: any = { initializeSchoolDefaultPermissions: jest.fn() };
            svc.initializeSchoolDefaultPermissions.mockResolvedValue(undefined);
            return svc;
          })(),
        },
      ],
    }).compile();

    listener = module.get<SchoolCreatedListener>(SchoolCreatedListener);
    permissionsService = module.get<PermissionsService>(PermissionsService);
    
    // Suppress logs during testing to keep output clean
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('should call initializeSchoolDefaultPermissions when school.created event is handled', async () => {
    const schoolId = 'test-school-uuid';
    const event = new SchoolCreatedEvent(schoolId);

    await listener.handleSchoolCreatedEvent(event);

    expect(permissionsService.initializeSchoolDefaultPermissions).toHaveBeenCalledWith(schoolId);
  });
});