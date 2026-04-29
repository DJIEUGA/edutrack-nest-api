import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
@Index(['scopeSchoolId', 'occurredAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId?: string | null;

  @Column({ name: 'scope_organization_id', type: 'uuid', nullable: true })
  scopeOrganizationId?: string | null;

  @Column({ name: 'scope_school_id', type: 'uuid', nullable: true })
  scopeSchoolId?: string | null;

  @Column({ type: 'text' })
  action!: string;

  @Column({ name: 'resource_type', type: 'text' })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
