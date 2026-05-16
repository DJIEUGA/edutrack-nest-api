import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { ClassesService } from '../application/classes.service';
import {
  ApproveEnrollmentDto,
  CreateClassDto,
  EnrollmentRequestDto,
  RejectEnrollmentDto,
  SetCapacityDto,
  TransferStudentDto,
  UpdateClassDto,
} from './dto/class.dto';

class ListClassesQuery {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

class ListEnrollmentRequestsQuery {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  // ── Student portal view — literal route MUST come before :classId ──────────

  @Get('my-class')
  @TenantScope({ level: 'school' })
  @Roles('student')
  @ApiOperation({ summary: "Get the authenticated student's full class overview" })
  async getMyClass(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const overview = await this.classes.getMyClassOverview(schoolId, user.userId);
    if (!overview) throw new NotFoundException('No class assigned to this student yet');
    return overview;
  }

  // ── Enrollment request routes (literal prefix before :classId) ────────────

  @Patch('enrollment-requests/:requestId/approve')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'Approve a class enrollment request' })
  approveEnrollment(
    @Param('schoolId') schoolId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ApproveEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classes.approveEnrollment(schoolId, requestId, user.userId, dto.overrideCap);
  }

  @Patch('enrollment-requests/:requestId/reject')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'Reject a class enrollment request' })
  rejectEnrollment(
    @Param('schoolId') schoolId: string,
    @Param('requestId') requestId: string,
    @Body() dto: RejectEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classes.rejectEnrollment(schoolId, requestId, user.userId, dto.notes);
  }

  // ── Collection endpoints ──────────────────────────────────────────────────

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List classes (optionally filtered by academic year)' })
  list(@Param('schoolId') schoolId: string, @Query() query: ListClassesQuery) {
    return this.classes.list(schoolId, query.academicYearId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Create a class' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateClassDto) {
    return this.classes.create({ schoolId, ...dto });
  }

  // ── Per-class: CRUD ───────────────────────────────────────────────────────

  @Get(':classId')
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'Get class details' })
  getOne(@Param('schoolId') schoolId: string, @Param('classId') classId: string) {
    return this.classes.getById(schoolId, classId);
  }

  @Patch(':classId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Update a class' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classes.update(schoolId, classId, dto);
  }

  @Delete(':classId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a class' })
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
  ) {
    await this.classes.delete(schoolId, classId);
    return { success: true };
  }

  // ── Per-class: capacity ───────────────────────────────────────────────────

  @Get(':classId/capacity')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Get current student count and capacity info for a class' })
  getCapacity(@Param('schoolId') schoolId: string, @Param('classId') classId: string) {
    return this.classes.getCapacity(schoolId, classId);
  }

  @Patch(':classId/capacity')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Set or update the max capacity for a class' })
  setCapacity(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Body() dto: SetCapacityDto,
  ) {
    return this.classes.update(schoolId, classId, { maxCapacity: dto.maxCapacity });
  }

  // ── Per-class: manual split ───────────────────────────────────────────────

  @Post(':classId/split')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @ApiOperation({ summary: 'Manually trigger an alphabetical split of a class into two sub-classes' })
  splitClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classes.splitClass(schoolId, classId, user.userId);
  }

  // ── Per-class: students ───────────────────────────────────────────────────

  @Get(':classId/students')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer')
  @ApiOperation({ summary: 'List all students enrolled in a class' })
  getStudents(@Param('schoolId') schoolId: string, @Param('classId') classId: string) {
    return this.classes.getClassStudents(schoolId, classId);
  }

  // ── Per-class: enrollment requests ────────────────────────────────────────

  @Post(':classId/enrollment-requests')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'student')
  @ApiOperation({ summary: 'Submit a class enrollment request for a student' })
  requestEnrollment(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Body() dto: EnrollmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classes.requestEnrollment({
      schoolId,
      studentId: dto.studentId,
      classId,
      requestedBy: user.userId,
      notes: dto.notes,
    });
  }

  @Get(':classId/enrollment-requests')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'List enrollment requests for a class' })
  listEnrollmentRequests(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query() query: ListEnrollmentRequestsQuery,
  ) {
    return this.classes.listEnrollmentRequests(schoolId, classId, query.status);
  }

  // ── Per-class: student transfer ───────────────────────────────────────────

  @Post(':classId/students/:studentId/transfer')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer a student into this class (with audit trail)' })
  async transferStudent(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @Body() dto: TransferStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.classes.transferStudent({
      schoolId,
      studentId,
      toClassId: classId,
      actorId: user.userId,
      reason: dto.reason,
    });
    return { success: true };
  }

  // ── Student transfer history ──────────────────────────────────────────────

  @Get(':classId/students/:studentId/transfer-history')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod')
  @ApiOperation({ summary: 'Get the class transfer history for a student' })
  getTransferHistory(
    @Param('studentId') studentId: string,
  ) {
    return this.classes.getTransferHistory(studentId);
  }
}
