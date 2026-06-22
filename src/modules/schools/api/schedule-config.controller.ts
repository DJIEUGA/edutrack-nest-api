import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ScheduleConfigService } from '../application/schedule-config.service';

@ApiTags('schedule-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/schedule-config')
export class ScheduleConfigController {
  constructor(private readonly scheduleConfig: ScheduleConfigService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer', 'student', 'guardian')
  @ApiOperation({ summary: 'Get the school schedule config (active weekdays + time blocks)' })
  getConfig(@Param('schoolId') schoolId: string) {
    return this.scheduleConfig.getConfig(schoolId);
  }

  @Post('time-blocks')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Add a time block to the school schedule' })
  addTimeBlock(
    @Param('schoolId') schoolId: string,
    @Body() dto: { label?: string; startTime: string; endTime: string },
  ) {
    return this.scheduleConfig.addTimeBlock(schoolId, dto);
  }

  @Delete('time-blocks/:blockId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Remove a time block from the school schedule' })
  deleteTimeBlock(@Param('schoolId') schoolId: string, @Param('blockId') blockId: string) {
    return this.scheduleConfig.deleteTimeBlock(schoolId, blockId);
  }

  @Put('days')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Set the active weekdays for the school (0=Sun … 6=Sat). Replaces existing.' })
  setScheduleDays(
    @Param('schoolId') schoolId: string,
    @Body() dto: { days: number[] },
  ) {
    return this.scheduleConfig.setScheduleDays(schoolId, dto.days);
  }
}
