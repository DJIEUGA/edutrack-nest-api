import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type PromotionCycleStatus = 'active' | 'completed' | 'expired';

@Entity({ name: 'promotion_cycles' })
@Unique(['schoolId', 'weekStart'])
export class PromotionCycle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'week_start', type: 'date' })
  weekStart!: string;

  @Column({ name: 'week_end', type: 'date' })
  weekEnd!: string;

  @Column({ name: 'triggered_by', type: 'uuid' })
  triggeredBy!: string;

  @Column({ name: 'triggered_at', type: 'timestamptz' })
  triggeredAt!: Date;

  @Column({
    type: 'enum',
    enum: ['active', 'completed', 'expired'],
    default: 'active',
  })
  status!: PromotionCycleStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
