import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type SchoolStatus = 'active' | 'inactive';

@Entity({ name: 'schools' })
@Unique(['organizationId', 'code'])
export class School {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status!: SchoolStatus;

  // Extended settings fields
  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'text', nullable: true })
  phone?: string | null;

  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  website?: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  timezone?: string | null;

  @Column({ name: 'session_duration_minutes', type: 'int', nullable: true })
  sessionDurationMinutes?: number | null;

  @Column({ name: 'late_threshold_minutes', type: 'int', nullable: true })
  lateThresholdMinutes?: number | null;

  @Column({ name: 'require_geo_checkin', type: 'boolean', default: false })
  requireGeoCheckin!: boolean;

  @Column({ name: 'allow_late_checkin', type: 'boolean', default: true })
  allowLateCheckin!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
