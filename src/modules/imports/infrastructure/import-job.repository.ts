import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportJob, ImportJobStatus } from '../domain/import-job.entity';

@Injectable()
export class ImportJobRepository {
  constructor(
    @InjectRepository(ImportJob)
    private readonly repo: Repository<ImportJob>,
  ) {}

  findById(id: string): Promise<ImportJob | null> {
    return this.repo.findOne({ where: { id } });
  }

  listBySchool(schoolId: string): Promise<ImportJob[]> {
    return this.repo.find({ where: { schoolId }, order: { createdAt: 'DESC' } });
  }

  create(input: {
    schoolId: string;
    initiatedBy: string;
    type: string;
    sourceFileUrl?: string | null;
  }): Promise<ImportJob> {
    return this.repo.save(this.repo.create({ ...input, status: 'created' }));
  }

  async updateStatus(
    id: string,
    status: ImportJobStatus,
    extra?: Partial<Pick<ImportJob, 'summary' | 'errors'>>,
  ): Promise<ImportJob | null> {
    await this.repo.update({ id }, { status, ...extra } as any);
    return this.findById(id);
  }
}
