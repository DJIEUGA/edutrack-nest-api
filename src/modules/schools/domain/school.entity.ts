import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type SchoolStatus = 'active' | 'inactive';

@Entity({ name: 'schools' })
@Unique(['organizationId', 'code'])
export class School {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status!: SchoolStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
