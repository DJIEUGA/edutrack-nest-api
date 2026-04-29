import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { SessionsController } from './api/sessions.controller';
import { SessionsService } from './application/sessions.service';
import { Session } from './domain/session.entity';
import { SessionRepository } from './infrastructure/session.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), RolesModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionRepository],
  exports: [SessionsService, SessionRepository],
})
export class SessionsModule {}
