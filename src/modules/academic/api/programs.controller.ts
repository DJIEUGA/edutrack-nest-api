import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ProgramsService } from '../application/programs.service';
import { CreateProgramDto, UpdateProgramDto } from './dto/program.dto';

@ApiTags('programs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List programs' })
  list(@Param('schoolId') schoolId: string) {
    return this.programs.list(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Create a program' })
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateProgramDto) {
    return this.programs.create({ schoolId, ...dto });
  }

  @Patch(':programId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Update a program' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('programId') programId: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.programs.update(schoolId, programId, dto);
  }

  @Delete(':programId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a program' })
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('programId') programId: string,
  ) {
    await this.programs.delete(schoolId, programId);
    return { success: true };
  }
}
