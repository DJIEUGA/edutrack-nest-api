import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/users/domain/user.entity';

@Entity({ name: 'profiles' })
export class Profile {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  user!: User;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({ type: 'text', nullable: true })
  phone?: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
