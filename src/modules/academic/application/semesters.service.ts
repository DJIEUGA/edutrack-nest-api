import { Injectable } from '@nestjs/common';
import { ValidationError } from '@common/errors/domain.errors';
import { Semester } from '../domain/semester.entity';
import { SemesterRepository } from '../infrastructure/semester.repository';
import { AcademicYearsService } from './academic-years.service';

@Injectable()
export class SemestersService {
  constructor(
    private readonly semesters: SemesterRepository,
    private readonly academicYears: AcademicYearsService,
  ) {}

  list(academicYearId: string): Promise<Semester[]> {
    return this.semesters.list(academicYearId);
  }

  async create(input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
  }): Promise<Semester> {
    const year = await this.academicYears.getById(input.schoolId, input.academicYearId);
    if (input.startDate < year.startDate || input.endDate > year.endDate) {
      throw new ValidationError('Semester dates must fall within the academic year', {
        yearStart: year.startDate,
        yearEnd: year.endDate,
      });
    }
    if (input.startDate >= input.endDate) {
      throw new ValidationError('startDate must be before endDate');
    }
    return this.semesters.create({
      academicYearId: input.academicYearId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent ?? false,
    });
  }
}
