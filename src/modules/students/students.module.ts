import { Module } from '@nestjs/common';
import { RolesModule } from '@modules/roles/roles.module';
import { StudentsController } from './api/students.controller';
import { StudentsService } from './application/students.service';
import { StudentsRepository } from './infrastructure/students.repository';

@Module({
  imports: [RolesModule],
  controllers: [StudentsController],
  providers: [
    StudentsService,
    StudentsRepository,
  ],
  exports: [StudentsService, StudentsRepository],
})
export class StudentsModule {}