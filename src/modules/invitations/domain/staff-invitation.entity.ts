import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, USER_ROLES } from '@common/types/role.types';

export type InvitationStatus = 'pending' | 'processing' | 'accepted' | 'expired' | 'cancelled';

@Entity({ name: 'staff_invitations' })
export class StaffInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  email!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ type: 'enum', enum: [...USER_ROLES] })
  role!: UserRole;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId?: string | null;

  @Column({ type: 'text', unique: true })
  token!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'accepted', 'expired', 'cancelled'],
    default: 'pending',
  })
  status!: InvitationStatus;

  @Column({ name: 'invited_by', type: 'uuid' })
  invitedBy!: string;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
