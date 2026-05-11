import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';

// Domain entities
import { AcademicYear } from './domain/academic-year.entity';
import { ClassEntity } from './domain/class.entity';
import { Course } from './domain/course.entity';
import { CourseAssignment } from './domain/course-assignment.entity';
import { Program } from './domain/program.entity';
import { Semester } from './domain/semester.entity';

// Controllers
import { AcademicYearsController } from './api/academic-years.controller';
import { ClassesController } from './api/classes.controller';
import { CourseAssignmentsController } from './api/course-assignments.controller';
import { CoursesController } from './api/courses.controller';
import { DepartmentsController } from './api/departments.controller';
import { ProgramsController } from './api/programs.controller';
import { SemestersController } from './api/semesters.controller';

// Services
import { AcademicYearsService } from './application/academic-years.service';
import { ClassesService } from './application/classes.service';
import { CourseAssignmentsService } from './application/course-assignments.service';
import { CoursesService } from './application/courses.service';
import { DepartmentsService } from './application/departments.service';
import { ProgramsService } from './application/programs.service';
import { SemestersService } from './application/semesters.service';

// Repositories
import { AcademicYearRepository } from './infrastructure/academic-year.repository';
import { ClassRepository } from './infrastructure/class.repository';
import { CourseAssignmentRepository } from './infrastructure/course-assignment.repository';
import { CoursesRepository } from './infrastructure/courses.repository';
import { DepartmentRepository } from './infrastructure/department.repository';
import { ProgramRepository } from './infrastructure/program.repository';
import { SemesterRepository } from './infrastructure/semester.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicYear,
      ClassEntity,
      Course,
      CourseAssignment,
      Program,
      Semester,
    ]),
    RolesModule,
  ],
  controllers: [
    AcademicYearsController,
    ClassesController,
    CourseAssignmentsController,
    CoursesController,
    DepartmentsController,
    ProgramsController,
    SemestersController,
  ],
  providers: [
    AcademicYearsService,
    ClassesService,
    CourseAssignmentsService,
    CoursesService,
    DepartmentsService,
    ProgramsService,
    SemestersService,
    AcademicYearRepository,
    ClassRepository,
    CourseAssignmentRepository,
    CoursesRepository,
    DepartmentRepository,
    ProgramRepository,
    SemesterRepository,
  ],
  exports: [
    AcademicYearsService,
    ClassesService,
    CourseAssignmentsService,
    CoursesService,
    DepartmentsService,
    ProgramsService,
    SemestersService,
    CoursesRepository,
    CourseAssignmentRepository,
    ProgramRepository,
  ],
})
export class AcademicModule {}
