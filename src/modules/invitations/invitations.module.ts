import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import {
  InvitationAcceptController,
  InvitationsController,
} from './api/invitations.controller';
import { InvitationsService } from './application/invitations.service';
import { StaffInvitation } from './domain/staff-invitation.entity';
import { StaffInvitationRepository } from './infrastructure/staff-invitation.repository';

@Module({
  imports: [TypeOrmModule.forFeature([StaffInvitation]), RolesModule],
  controllers: [InvitationsController, InvitationAcceptController],
  providers: [InvitationsService, StaffInvitationRepository],
  exports: [InvitationsService],
})
export class InvitationsModule {}
