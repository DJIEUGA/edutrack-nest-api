import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundError } from '@common/errors/domain.errors';

export interface UpdateSlotFieldsDto {
  startTime?: string;
  endTime?: string;
  venue?: string | null;
}

@Injectable()
export class TimetablePublicService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async updateSlotFields(
    schoolId: string,
    slotId: string,
    dto: UpdateSlotFieldsDto,
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [slotId, schoolId];
    let idx = 3;

    if (dto.startTime !== undefined) {
      setClauses.push(`start_time = $${idx++}`);
      params.push(dto.startTime);
    }
    if (dto.endTime !== undefined) {
      setClauses.push(`end_time = $${idx++}`);
      params.push(dto.endTime);
    }
    if (dto.venue !== undefined) {
      setClauses.push(`venue = $${idx++}`);
      params.push(dto.venue);
    }

    if (setClauses.length === 1) return; // nothing to update beyond updated_at

    const result = await this.dataSource.query(
      `UPDATE timetable_slots SET ${setClauses.join(', ')}
       WHERE id = $1 AND school_id = $2`,
      params,
    );
    if (result[1] === 0) throw new NotFoundError('Timetable slot not found');
  }

  // Deletes the slot record only. Caller is responsible for cancelling sessions first.
  // Nulls the timetable_slot_id FK on any remaining session rows to avoid constraint errors.
  async deleteSlotRecord(schoolId: string, slotId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE sessions SET timetable_slot_id = NULL WHERE timetable_slot_id = $1`,
        [slotId],
      );
      const result = await manager.query(
        `DELETE FROM timetable_slots WHERE id = $1 AND school_id = $2`,
        [slotId, schoolId],
      );
      if (result[1] === 0) throw new NotFoundError('Timetable slot not found');
    });
  }
}
