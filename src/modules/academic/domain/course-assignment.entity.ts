import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'course_assignments' })
@Unique(['schoolId', 'courseId', 'classId', 'lecturerUserId', 'academicYearId'])
export class CourseAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'class_id', type: 'uuid' })
  classId!: string;

  @Column({ name: 'lecturer_user_id', type: 'uuid' })
  lecturerUserId!: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
