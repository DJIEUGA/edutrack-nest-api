import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundError, ValidationError } from '@common/errors/domain.errors';
import { StudentsService } from '@modules/students/application/students.service';

@Injectable()
export class ImportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly studentsService: StudentsService,
  ) {}

  async listJobs(schoolId: string) {
    return this.dataSource.query(
      'SELECT id, type, status, source_file_url as "sourceFileUrl", errors, created_at as "createdAt" FROM import_jobs WHERE school_id = $1 ORDER BY created_at DESC',
      [schoolId],
    );
  }

  async createJob(schoolId: string, userId: string, dto: { type: string; sourceFileUrl: string }) {
    const [job] = await this.dataSource.query(
      `INSERT INTO import_jobs (school_id, initiated_by, type, source_file_url, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, type, status, source_file_url as "sourceFileUrl"`,
      [schoolId, userId, dto.type, dto.sourceFileUrl],
    );

    // Phase 2: Automatic Validation Trigger (In a real app, this might be a background worker)
    await this.validateJob(job.id, schoolId);
    
    return this.getJob(job.id, schoolId);
  }

  async getJob(id: string, schoolId: string) {
    const [job] = await this.dataSource.query(
      'SELECT id, type, status, source_file_url as "sourceFileUrl", errors FROM import_jobs WHERE id = $1 AND school_id = $2',
      [id, schoolId],
    );
    if (!job) throw new NotFoundError('Import job not found');
    return job;
  }

  private async validateJob(id: string, schoolId: string) {
    // Mocking validation logic: Check if file exists and headers match Section 17.4
    // In production, use a CSV parser here.
    await this.dataSource.query(
      "UPDATE import_jobs SET status = 'awaiting_confirmation' WHERE id = $1",
      [id],
    );
  }

  async commitJob(id: string, schoolId: string) {
    const job = await this.getJob(id, schoolId);
    if (job.status !== 'awaiting_confirmation') {
      throw new ValidationError('Job must be validated before it can be committed', { code: 'IMPORT_NOT_VALIDATED' });
    }

    return await this.dataSource.transaction(async (manager) => {
      // Phase 3: Commit
      // Mocking the data extraction from the sourceFileUrl
      if (job.type === 'students') {
        // Example data that would be parsed from CSV
        const mockData:any = []; 
        await this.studentsService.bulkImport(schoolId, mockData);
      }

      await manager.query(
        "UPDATE import_jobs SET status = 'committed', updated_at = NOW() WHERE id = $1",
        [id],
      );

      return { success: true, status: 'committed' };
    });
  }

  async cancelJob(id: string, schoolId: string) {
    const result = await this.dataSource.query(
      "DELETE FROM import_jobs WHERE id = $1 AND school_id = $2 AND status != 'committed'",
      [id, schoolId],
    );
    if (result[1] === 0) throw new ValidationError('Cannot cancel a committed job');
    return { success: true };
  }
}