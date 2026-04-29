import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './api/audit.controller';
import { AuditService } from './application/audit.service';
import { AuditLog } from './domain/audit-log.entity';
import { AuditLogRepository } from './infrastructure/audit-log.repository';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), forwardRef(() => RolesModule)],
  controllers: [AuditController],
  providers: [AuditService, AuditLogRepository],
  exports: [AuditService],
})
export class AuditModule {}
