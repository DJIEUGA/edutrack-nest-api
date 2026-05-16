import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'class_transfer_logs' })
@Index(['studentId'])
export class ClassTransferLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'from_class_id', type: 'uuid', nullable: true })
  fromClassId?: string | null;

  @Column({ name: 'to_class_id', type: 'uuid', nullable: true })
  toClassId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ name: 'transferred_by', type: 'uuid' })
  transferredBy!: string;

  @Column({ name: 'transferred_at', type: 'timestamptz' })
  transferredAt!: Date;
}
