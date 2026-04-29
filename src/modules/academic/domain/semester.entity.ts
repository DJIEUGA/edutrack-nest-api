import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'semesters' })
export class Semester {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
