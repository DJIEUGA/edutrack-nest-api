import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listLogs(schoolId: string, limit: number = 50, offset: number = 0) {
    return this.dataSource.query(
      `SELECT 
         a.id, a.action, a.resource_type as "resource", a.resource_id as "resourceId",
         a.created_at as "createdAt", a.metadata,
         p.full_name as "actorName",
         u.email as "actorEmail"
       FROM audit_logs a
       JOIN users u ON a.actor_user_id = u.id
       JOIN profiles p ON u.id = p.id
       WHERE a.scope_school_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [schoolId, limit, offset],
    );
  }
}