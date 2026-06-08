import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'students' })
@Unique(['schoolId', 'matricNo'])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true, unique: true })
  userId?: string | null;

  @Column({ name: 'matric_no', type: 'text', nullable: true })
  matricNo?: string | null;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId?: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
