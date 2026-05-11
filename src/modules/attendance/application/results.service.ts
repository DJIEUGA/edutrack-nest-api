import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ResultsRepository } from '../infrastructure/results.repository';

@Injectable()
export class ResultsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly resultsRepository: ResultsRepository,
  ) {}

  async submitGrades(schoolId: string, actorId: string, dto: {
    academicYearId: string;
    courseId: string;
    classId: string;
    results: { studentId: string; score: number; grade: string }[];
  }) {
    return await this.dataSource.transaction(async (manager) => {
      const savedResults = [];
      for (const res of dto.results) {
        const result = await this.resultsRepository.upsertResult(
          manager,
          schoolId,
          dto.academicYearId,
          dto.courseId,
          res.studentId,
          res.score,
          res.grade,
          actorId,
        );
        savedResults.push(result);
      }

      // Audit log for grade entry (Critical for transcript integrity)
      await manager.query(
        `INSERT INTO audit_logs (actor_user_id, scope_school_id, action, resource_type, metadata)
         VALUES ($1, $2, 'results:bulk_submit', 'academic_result', $3)`,
        [actorId, schoolId, JSON.stringify({ courseId: dto.courseId, count: dto.results.length })]
      );

      return savedResults;
    });
  }

  async getStudentResults(studentId: string, academicYearId?: string) {
    return this.resultsRepository.findByStudent(studentId, academicYearId);
  }
}