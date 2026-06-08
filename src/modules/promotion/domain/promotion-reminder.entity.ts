import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'promotion_reminders' })
@Index(['lecturerUserId', 'isRead'])
export class PromotionReminder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'promotion_cycle_id', type: 'uuid' })
  promotionCycleId!: string;

  @Column({ name: 'lecturer_user_id', type: 'uuid' })
  lecturerUserId!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
