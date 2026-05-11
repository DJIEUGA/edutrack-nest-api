import { Module } from '@nestjs/common';
import { RolesModule } from '@modules/roles/roles.module';
import { SessionsController } from './api/sessions.controller';
import { SessionReportingController } from './api/session-reporting.controller';
import { SessionsService } from './application/sessions.service';
import { SessionReportingService } from './application/session-reporting.service';

@Module({
  imports: [RolesModule],
  controllers: [
    SessionsController,
    SessionReportingController,
  ],
  providers: [
    SessionsService,
    SessionReportingService,
  ],
  exports: [SessionsService, SessionReportingService],
})
export class SessionsModule {}