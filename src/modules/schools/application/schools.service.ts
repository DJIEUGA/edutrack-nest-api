import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictError, InvalidStateTransitionError, NotFoundError } from '@common/errors/domain.errors';
import { School, SchoolStatus } from '../domain/school.entity';
import { UpdateSchoolDto } from '../api/dto/update-school.dto';
import { SchoolRepository } from '../infrastructure/school.repository';

@Injectable()
export class SchoolsService {
  constructor(
    private readonly schools: SchoolRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  list(organizationId: string, filters?: { status?: string; q?: string }): Promise<School[]> {
    return this.schools.listByOrganization(organizationId, filters);
  }

  async getByIdDirect(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId);
    if (!school) throw new NotFoundError('School not found', { schoolId });
    return school;
  }

  async getById(organizationId: string, schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId);
    if (!school || school.organizationId !== organizationId) {
      throw new NotFoundError('School not found', { schoolId });
    }
    return school;
  }

  async create(input: {
    organizationId: string;
    name: string;
    code: string;
    creatorUserId: string;
  }): Promise<School> {
    const existing = await this.schools.findByOrgAndCode(input.organizationId, input.code);
    if (existing) {
      throw new ConflictError('School code already in use within this organization', {
        code: input.code,
      });
    }
    return this.schools.createWithMembership(input);
  }

  async update(organizationId: string, schoolId: string, patch: UpdateSchoolDto): Promise<School> {
    await this.getById(organizationId, schoolId);
    const updated = await this.schools.update(schoolId, patch as Partial<School>);
    if (!updated) throw new NotFoundError('School not found', { schoolId });
    return updated;
  }

  async setLogo(organizationId: string, schoolId: string, logoUrl: string | null): Promise<School> {
    await this.getById(organizationId, schoolId);
    const updated = await this.schools.update(schoolId, { logoUrl });
    if (!updated) throw new NotFoundError('School not found', { schoolId });
    return updated;
  }

  async delete(organizationId: string, schoolId: string): Promise<void> {
    const school = await this.getById(organizationId, schoolId);
    if (school.status === 'active') {
      throw new InvalidStateTransitionError(
        'School has active records and cannot be deleted. Deactivate it first.',
      );
    }
    await this.schools.delete(schoolId);
  }

  async getGuardianStudents(schoolId: string, guardianUserId: string) {
    return this.dataSource.query(
      `SELECT gs.student_id as "studentId", p.full_name as "fullName",
              s.matric_no as "matricNo", s.class_id as "classId"
       FROM guardian_students gs
       JOIN students s ON gs.student_id = s.id
       JOIN profiles p ON s.user_id = p.id
       WHERE gs.guardian_user_id = $1 AND s.school_id = $2`,
      [guardianUserId, schoolId],
    );
  }
}
