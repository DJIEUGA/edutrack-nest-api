import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../domain/audit-log.entity';

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  create(input: Partial<AuditLog>): Promise<AuditLog> {
    const entity = this.repo.create(input);
    return this.repo.save(entity);
  }

  async listForSchool(schoolId: string, limit = 50, offset = 0): Promise<[AuditLog[], number]> {
    return this.repo.findAndCount({
      where: { scopeSchoolId: schoolId },
      order: { occurredAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
