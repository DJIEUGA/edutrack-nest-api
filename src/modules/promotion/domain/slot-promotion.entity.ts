import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type SlotPromotionStatus = 'pending' | 'confirmed' | 'modified' | 'reset';

@Entity({ name: 'slot_promotions' })
@Unique(['promotionCycleId', 'timetableSlotId'])
@Index(['lecturerUserId', 'status'])
@Index(['promotionCycleId', 'status'])
export class SlotPromotion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'promotion_cycle_id', type: 'uuid' })
  promotionCycleId!: string;

  @Column({ name: 'timetable_slot_id', type: 'uuid' })
  timetableSlotId!: string;

  @Column({ name: 'lecturer_user_id', type: 'uuid' })
  lecturerUserId!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'modified', 'reset'],
    default: 'pending',
  })
  status!: SlotPromotionStatus;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt?: Date | null;

  @Column({ name: 'reset_at', type: 'timestamptz', nullable: true })
  resetAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
