import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ProgramLevelsService } from '../application/program-levels.service';
import { CreateProgramLevelDto } from './dto/program-level.dto';

@ApiTags('program-levels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/programs/:programId/levels')
export class ProgramLevelsController {
  constructor(private readonly levels: ProgramLevelsService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @ApiOperation({ summary: 'List levels defined for a program' })
  list(@Param('programId') programId: string) {
    return this.levels.listByProgram(programId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Define a level for a program' })
  create(
    @Param('schoolId') schoolId: string,
    @Param('programId') programId: string,
    @Body() dto: CreateProgramLevelDto,
  ) {
    return this.levels.create({ schoolId, programId, ...dto });
  }
}
