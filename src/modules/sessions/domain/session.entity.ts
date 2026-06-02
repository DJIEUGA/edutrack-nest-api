import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

@Entity({ name: 'sessions' })
@Index(['schoolId', 'scheduledDate'])
@Index(['courseAssignmentId', 'scheduledDate'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'course_assignment_id', type: 'uuid' })
  courseAssignmentId!: string;

  @Column({ name: 'timetable_slot_id', type: 'uuid', nullable: true })
  timetableSlotId?: string | null;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate!: string;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled',
  })
  status!: SessionStatus;

  @Column({ name: 'actual_start', type: 'timestamptz', nullable: true })
  actualStart?: Date | null;

  @Column({ name: 'actual_end', type: 'timestamptz', nullable: true })
  actualEnd?: Date | null;

  @Column({ name: 'start_lat', type: 'double precision', nullable: true })
  startLat?: number | null;

  @Column({ name: 'start_lng', type: 'double precision', nullable: true })
  startLng?: number | null;

  @Column({ name: 'start_accuracy', type: 'double precision', nullable: true })
  startAccuracy?: number | null;

  @Column({ name: 'started_by', type: 'uuid', nullable: true })
  startedBy?: string | null;

  @Column({ name: 'ended_by', type: 'uuid', nullable: true })
  endedBy?: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason?: string | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
