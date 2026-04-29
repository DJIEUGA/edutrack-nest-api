import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '@modules/roles/roles.module';
import { StudentsController } from './api/students.controller';
import { StudentsService } from './application/students.service';
import { Student } from './domain/student.entity';
import { StudentRepository } from './infrastructure/student.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Student]), RolesModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentRepository],
  exports: [StudentsService, StudentRepository],
})
export class StudentsModule {}
