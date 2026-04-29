import { Injectable, Logger } from '@nestjs/common';
import { AuditLogRepository } from '../infrastructure/audit-log.repository';

export interface AuditEvent {
  actorUserId?: string | null;
  scopeOrganizationId?: string | null;
  scopeSchoolId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditLogRepository) {}

  /**
   * Persists an audit event. Failures are logged but do not propagate; audit
   * writes must never break a user-visible operation.
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      await this.repo.create({
        actorUserId: event.actorUserId ?? null,
        scopeOrganizationId: event.scopeOrganizationId ?? null,
        scopeSchoolId: event.scopeSchoolId ?? null,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        metadata: event.metadata ?? null,
      });
    } catch (err) {
      this.logger.error({ err, event }, 'Failed to persist audit log');
    }
  }
}
