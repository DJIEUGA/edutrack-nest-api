import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ImportJobStatus =
  | 'created'
  | 'validating'
  | 'ready'
  | 'committing'
  | 'completed'
  | 'failed';

@Entity({ name: 'import_jobs' })
@Index(['schoolId', 'status'])
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'initiated_by', type: 'uuid' })
  initiatedBy!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({
    type: 'enum',
    enum: ['created', 'validating', 'ready', 'committing', 'completed', 'failed'],
    default: 'created',
  })
  status!: ImportJobStatus;

  @Column({ name: 'source_file_url', type: 'text', nullable: true })
  sourceFileUrl?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  summary?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  errors?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
