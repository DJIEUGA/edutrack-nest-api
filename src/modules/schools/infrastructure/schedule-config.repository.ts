import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictError } from '@common/errors/domain.errors';

export interface TimeBlockRow {
  id: string;
  schoolId: string;
  label: string | null;
  startTime: string;
  endTime: string;
}

@Injectable()
export class ScheduleConfigRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getTimeBlocks(schoolId: string): Promise<TimeBlockRow[]> {
    return this.dataSource.query(
      `SELECT id, school_id as "schoolId", label,
              start_time as "startTime", end_time as "endTime"
       FROM school_time_blocks
       WHERE school_id = $1
       ORDER BY start_time ASC`,
      [schoolId],
    );
  }

  async getScheduleDays(schoolId: string): Promise<number[]> {
    const rows: { day_of_week: number }[] = await this.dataSource.query(
      `SELECT day_of_week FROM school_schedule_days WHERE school_id = $1 ORDER BY day_of_week ASC`,
      [schoolId],
    );
    return rows.map((r) => r.day_of_week);
  }

  async addTimeBlock(
    schoolId: string,
    dto: { label?: string; startTime: string; endTime: string },
  ): Promise<TimeBlockRow> {
    try {
      const [block] = await this.dataSource.query(
        `INSERT INTO school_time_blocks (school_id, label, start_time, end_time)
         VALUES ($1, $2, $3::time, $4::time)
         RETURNING id, school_id as "schoolId", label,
                   start_time as "startTime", end_time as "endTime"`,
        [schoolId, dto.label ?? null, dto.startTime, dto.endTime],
      );
      return block;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictError('A time block with this start/end time already exists for the school');
      }
      throw err;
    }
  }

  async deleteTimeBlock(id: string, schoolId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `DELETE FROM school_time_blocks WHERE id = $1 AND school_id = $2`,
      [id, schoolId],
    );
    return result[1] > 0;
  }

  async setScheduleDays(schoolId: string, days: number[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM school_schedule_days WHERE school_id = $1`,
        [schoolId],
      );
      if (days.length === 0) return;
      const placeholders = days.map((_, i) => `($1, $${i + 2})`).join(', ');
      await manager.query(
        `INSERT INTO school_schedule_days (school_id, day_of_week) VALUES ${placeholders}`,
        [schoolId, ...days],
      );
    });
  }

  async timeBlockExists(schoolId: string, startTime: string, endTime: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT 1 FROM school_time_blocks
       WHERE school_id = $1 AND start_time = $2::time AND end_time = $3::time
       LIMIT 1`,
      [schoolId, startTime, endTime],
    );
    return !!row;
  }
}
