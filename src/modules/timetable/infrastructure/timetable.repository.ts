import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TimetableRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(schoolId: string, academicYearId?: string) {
    return this.dataSource.query(
      `SELECT ts.id, ts.school_id as "schoolId", ts.academic_year_id as "academicYearId",
              ts.course_assignment_id as "courseAssignmentId", ts.day_of_week as "dayOfWeek",
              ts.start_time as "startTime", ts.end_time as "endTime", ts.venue
       FROM timetable_slots ts
       WHERE ts.school_id = $1 AND ($2::uuid IS NULL OR ts.academic_year_id = $2)`,
      [schoolId, academicYearId || null],
    );
  }

  async findById(id: string, schoolId: string) {
    const [row] = await this.dataSource.query(
      `SELECT id, school_id as "schoolId", academic_year_id as "academicYearId", 
              course_assignment_id as "courseAssignmentId", day_of_week as "dayOfWeek", 
              start_time as "startTime", end_time as "endTime", venue
       FROM timetable_slots WHERE id = $1 AND school_id = $2`,
      [id, schoolId],
    );
    return row || null;
  }

  async checkConflict(
    manager: EntityManager,
    schoolId: string,
    dayOfWeek: number,
    venue: string,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<boolean> {
    const [conflict] = await manager.query(
      `SELECT id FROM timetable_slots 
       WHERE school_id = $1 AND day_of_week = $2 AND venue = $3
       AND ($4::uuid IS NULL OR id != $4)
       AND (start_time, end_time) OVERLAPS ($5::time, $6::time)`,
      [schoolId, dayOfWeek, venue, excludeId || null, startTime, endTime],
    );
    return !!conflict;
  }

  async create(manager: EntityManager, schoolId: string, dto: any) {
    const [slot] = await manager.query(
      `INSERT INTO timetable_slots (school_id, academic_year_id, course_assignment_id, day_of_week, start_time, end_time, venue)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, school_id as "schoolId", day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", venue`,
      [schoolId, dto.academicYearId, dto.courseAssignmentId, dto.dayOfWeek, dto.startTime, dto.endTime, dto.venue],
    );
    return slot;
  }

  async update(manager: EntityManager, id: string, schoolId: string, data: any) {
    const [slot] = await manager.query(
      `UPDATE timetable_slots 
       SET day_of_week = $1, start_time = $2, end_time = $3, venue = $4, updated_at = NOW()
       WHERE id = $5 AND school_id = $6
       RETURNING id, school_id as "schoolId", day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", venue`,
      [data.dayOfWeek, data.startTime, data.endTime, data.venue, id, schoolId],
    );
    return slot;
  }

  async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'DELETE FROM timetable_slots WHERE id = $1 AND school_id = $2',
      [id, schoolId],
    );
    return result[1] > 0;
  }
}