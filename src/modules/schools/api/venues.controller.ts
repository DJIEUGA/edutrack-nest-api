import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { VenuesService } from '../application/venues.service';

@ApiTags('venues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'director', 'hod', 'lecturer')
  @ApiOperation({ summary: 'List all venues for a school' })
  list(@Param('schoolId') schoolId: string) {
    return this.venues.list(schoolId);
  }

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a new venue' })
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: { name: string; latitude?: number; longitude?: number },
  ) {
    return this.venues.create(schoolId, dto);
  }

  @Patch(':venueId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a venue' })
  update(
    @Param('schoolId') schoolId: string,
    @Param('venueId') venueId: string,
    @Body() dto: { name?: string; latitude?: number; longitude?: number },
  ) {
    return this.venues.update(schoolId, venueId, dto);
  }

  @Delete(':venueId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete a venue' })
  remove(@Param('schoolId') schoolId: string, @Param('venueId') venueId: string) {
    return this.venues.delete(schoolId, venueId);
  }
}