import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SchoolCreatedEvent } from './school-created.event';
import { PermissionsService } from './permissions.service';

@Injectable()
export class SchoolCreatedListener {
  private readonly logger = new Logger(SchoolCreatedListener.name);

  constructor(private readonly permissionsService: PermissionsService) {}

  @OnEvent('school.created', { async: true })
  async handleSchoolCreatedEvent(event: SchoolCreatedEvent) {
    this.logger.log(`Initializing default permissions for new school: ${event.schoolId}`);
    
    try {
      await this.permissionsService.initializeSchoolDefaultPermissions(event.schoolId);
      this.logger.log(`Successfully initialized permissions for school: ${event.schoolId}`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize permissions for school ${event.schoolId}: ${error?.message || error}`);
    }
  }
}