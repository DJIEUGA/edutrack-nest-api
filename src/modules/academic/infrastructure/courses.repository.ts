import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class CoursesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(schoolId: string) {
    return this.dataSource.query(
      `SELECT id, school_id as "schoolId", code, title, 
              unit_load as "unitLoad", department_id as "departmentId"
       FROM courses WHERE school_id = $1 ORDER BY code ASC`,
      [schoolId],
    );
  }

  async create(schoolId: string, dto: { 
    code: string; 
    title: string; 
    unitLoad: number; 
    departmentId?: string 
  }) {
    const [course] = await this.dataSource.query(
      `INSERT INTO courses (school_id, code, title, unit_load, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, school_id as "schoolId", code, title, unit_load as "unitLoad", department_id as "departmentId"`,
      [schoolId, dto.code.toUpperCase(), dto.title, dto.unitLoad, dto.departmentId],
    );
    return course;
  }

  async createAssignment(manager: EntityManager, schoolId: string, dto: {
    courseId: string;
    classId: string;
    lecturerUserId: string;
    academicYearId: string;
  }) {
    const [assignment] = await manager.query(
      `INSERT INTO course_assignments (school_id, course_id, class_id, lecturer_user_id, academic_year_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, course_id as "courseId", class_id as "classId", 
                 lecturer_user_id as "lecturerUserId", academic_year_id as "academicYearId"`,
      [schoolId, dto.courseId, dto.classId, dto.lecturerUserId, dto.academicYearId],
    );
    return assignment;
  }

  async update(id: string, schoolId: string, dto: {
    code?: string;
    title?: string;
    unitLoad?: number;
    departmentId?: string | null;
  }) {
    const [course] = await this.dataSource.query(
      `UPDATE courses SET
       code = COALESCE($1, code),
       title = COALESCE($2, title),
       unit_load = COALESCE($3, unit_load),
       department_id = COALESCE($4, department_id),
       updated_at = NOW()
       WHERE id = $5 AND school_id = $6
       RETURNING id, school_id as "schoolId", code, title, unit_load as "unitLoad", department_id as "departmentId"`,
      [dto.code?.toUpperCase(), dto.title, dto.unitLoad, dto.departmentId, id, schoolId],
    );
    return course || null;
  }

  async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'DELETE FROM courses WHERE id = $1 AND school_id = $2',
      [id, schoolId],
    );
    return result[1] > 0;
  }

  async findAllAssignments(schoolId: string, academicYearId?: string) {
    return this.dataSource.query(
      `SELECT id, school_id as "schoolId", course_id as "courseId", 
              class_id as "classId", lecturer_user_id as "lecturerUserId", 
              academic_year_id as "academicYearId"
       FROM course_assignments 
       WHERE school_id = $1 
         AND ($2::uuid IS NULL OR academic_year_id = $2)`,
      [schoolId, academicYearId || null],
    );
  }
}