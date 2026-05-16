import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateClassDto {
  @ApiProperty()
  @IsUUID()
  academicYearId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  @ApiPropertyOptional({ description: 'Max students before auto-split is triggered' })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxCapacity?: number;
}

export class UpdateClassDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  programId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxCapacity?: number | null;
}

export class SetCapacityDto {
  @ApiProperty({ description: 'Max students before auto-split is triggered' })
  @IsInt()
  @Min(2)
  maxCapacity!: number;
}

export class EnrollmentRequestDto {
  @ApiProperty({ description: 'Student ID to enroll into the class' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveEnrollmentDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Set true to approve even when the class is at max capacity',
  })
  @IsOptional()
  @IsBoolean()
  overrideCap?: boolean;
}

export class RejectEnrollmentDto {
  @ApiPropertyOptional({ description: 'Optional reason for rejection' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransferStudentDto {
  @ApiPropertyOptional({ description: 'Reason for the transfer (stored in audit trail)' })
  @IsOptional()
  @IsString()
  reason?: string;
}
