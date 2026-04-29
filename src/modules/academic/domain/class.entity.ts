import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'classes' })
@Unique(['schoolId', 'academicYearId', 'name'])
export class ClassEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId!: string;

  @Column({ name: 'program_id', type: 'uuid', nullable: true })
  programId?: string | null;

  @Column({ name: 'specialty_id', type: 'uuid', nullable: true })
  specialtyId?: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'int', nullable: true })
  level?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
