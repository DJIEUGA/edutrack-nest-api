import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { AcademicYearsController } from './api/academic-years.controller';
import { ClassesController } from './api/classes.controller';
import { CourseAssignmentsController } from './api/course-assignments.controller';
import { CoursesController } from './api/courses.controller';
import { DepartmentsController } from './api/departments.controller';
import { ProgramsController } from './api/programs.controller';
import { SemestersController } from './api/semesters.controller';
import { AcademicYearsService } from './application/academic-years.service';
import { ClassesService } from './application/classes.service';
import { CourseAssignmentsService } from './application/course-assignments.service';
import { CoursesService } from './application/courses.service';
import { DepartmentsService } from './application/departments.service';
import { ProgramsService } from './application/programs.service';
import { SemestersService } from './application/semesters.service';
import { AcademicYear } from './domain/academic-year.entity';
import { ClassEntity } from './domain/class.entity';
import { Course } from './domain/course.entity';
import { CourseAssignment } from './domain/course-assignment.entity';
import { Department } from './domain/department.entity';
import { Program } from './domain/program.entity';
import { Semester } from './domain/semester.entity';
import { AcademicYearRepository } from './infrastructure/academic-year.repository';
import { ClassRepository } from './infrastructure/class.repository';
import { CourseAssignmentRepository } from './infrastructure/course-assignment.repository';
import { CourseRepository } from './infrastructure/course.repository';
import { DepartmentRepository } from './infrastructure/department.repository';
import { ProgramRepository } from './infrastructure/program.repository';
import { SemesterRepository } from './infrastructure/semester.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicYear,
      Semester,
      Department,
      Program,
      Course,
      ClassEntity,
      CourseAssignment,
    ]),
    RolesModule,
  ],
  controllers: [
    AcademicYearsController,
    SemestersController,
    DepartmentsController,
    ProgramsController,
    CoursesController,
    ClassesController,
    CourseAssignmentsController,
  ],
  providers: [
    AcademicYearsService,
    SemestersService,
    DepartmentsService,
    ProgramsService,
    CoursesService,
    ClassesService,
    CourseAssignmentsService,
    AcademicYearRepository,
    SemesterRepository,
    DepartmentRepository,
    ProgramRepository,
    CourseRepository,
    ClassRepository,
    CourseAssignmentRepository,
  ],
  exports: [
    AcademicYearsService,
    CoursesService,
    ClassesService,
    CourseAssignmentsService,
    AcademicYearRepository,
    CourseAssignmentRepository,
  ],
})
export class AcademicModule {}
