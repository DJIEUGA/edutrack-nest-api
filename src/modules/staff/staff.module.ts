import { Module } from '@nestjs/common';
import { RolesModule } from '@modules/roles/roles.module';
import { StaffService } from './application/staff.service';
import { StaffController } from './api/staff.controller';

@Module({
  imports: [RolesModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
