import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { PromotionService } from '../application/promotion.service';
import { CreatePromotionCycleDto } from './dto/create-promotion-cycle.dto';

@ApiTags('promotion-cycles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/promotion-cycles')
export class PromotionCycleController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Trigger a new weekly promotion cycle for the school' })
  trigger(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromotionCycleDto,
  ) {
    return this.promotionService.triggerPromotion(schoolId, user.userId, dto.weekStart);
  }

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'List all promotion cycles for the school with per-cycle stats' })
  list(@Param('schoolId') schoolId: string) {
    return this.promotionService.listCycles(schoolId);
  }

  // Static route — must be declared before /:cycleId to avoid param conflict.
  @Get('active/me')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: "Get the active promotion cycle with the lecturer's pending slots" })
  getMyActive(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotionService.getMyActiveCycle(schoolId, user.userId);
  }

  @Get(':cycleId')
  @TenantScope({ level: 'school' })
  @Roles('owner', 'admin', 'hod')
  @ApiOperation({ summary: 'Get a promotion cycle with per-slot confirmation status' })
  getDetail(
    @Param('schoolId') schoolId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.promotionService.getCycleDetail(schoolId, cycleId);
  }
}
