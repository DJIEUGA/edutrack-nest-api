import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCourseAssignmentDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty()
  @IsUUID()
  classId!: string;

  @ApiProperty()
  @IsUUID()
  lecturerUserId!: string;

  @ApiProperty()
  @IsUUID()
  academicYearId!: string;
}
