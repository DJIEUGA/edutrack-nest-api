import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

@Entity({ name: 'attendance_records' })
@Unique(['sessionId', 'studentId'])
@Index(['schoolId', 'sessionId'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ type: 'enum', enum: ['present', 'absent', 'late', 'excused'] })
  status!: AttendanceStatus;

  @Column({ name: 'marked_by', type: 'uuid', nullable: true })
  markedBy?: string | null;

  @Column({ name: 'marked_at', type: 'timestamptz' })
  markedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
