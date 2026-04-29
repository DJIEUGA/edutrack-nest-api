import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@common/errors/domain.errors';
import { ImportJob } from '../domain/import-job.entity';
import { ImportJobRepository } from '../infrastructure/import-job.repository';

@Injectable()
export class ImportsService {
  constructor(private readonly jobs: ImportJobRepository) {}

  listBySchool(schoolId: string): Promise<ImportJob[]> {
    return this.jobs.listBySchool(schoolId);
  }

  async getById(schoolId: string, id: string): Promise<ImportJob> {
    const job = await this.jobs.findById(id);
    if (!job || job.schoolId !== schoolId) {
      throw new NotFoundError('Import job not found', { id });
    }
    return job;
  }

  create(input: {
    schoolId: string;
    initiatedBy: string;
    type: string;
    sourceFileUrl?: string | null;
  }): Promise<ImportJob> {
    return this.jobs.create(input);
  }

  async commit(
    schoolId: string,
    id: string,
  ): Promise<ImportJob> {
    const job = await this.getById(schoolId, id);
    if (job.status !== 'ready') {
      throw new Error(`Job must be in 'ready' state to commit (current: '${job.status}')`);
    }
    const updated = await this.jobs.updateStatus(id, 'committing');
    // Actual commit logic would be dispatched to a queue / worker here.
    return updated!;
  }
}
