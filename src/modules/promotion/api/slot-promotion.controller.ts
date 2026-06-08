import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { PromotionService } from '../application/promotion.service';
import { ModifySlotLevelDto } from './dto/modify-slot-level.dto';
import { RescheduleSessionDto } from './dto/reschedule-session.dto';

@ApiTags('slot-promotions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/slot-promotions')
export class SlotPromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post(':slotPromotionId/confirm')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'Explicitly confirm a slot promotion' })
  confirm(
    @Param('schoolId') schoolId: string,
    @Param('slotPromotionId') slotPromotionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotionService.confirmSlot(schoolId, slotPromotionId, user.userId);
  }

  @Patch(':slotPromotionId/slot')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'Modify slot-level fields (time/venue) — auto-confirms the promotion' })
  modifySlot(
    @Param('schoolId') schoolId: string,
    @Param('slotPromotionId') slotPromotionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifySlotLevelDto,
  ) {
    return this.promotionService.modifySlotLevel(schoolId, slotPromotionId, user.userId, dto);
  }

  @Patch(':slotPromotionId/sessions/:sessionId/reschedule')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'Reschedule a single session instance — auto-confirms the promotion' })
  rescheduleSession(
    @Param('schoolId') schoolId: string,
    @Param('slotPromotionId') slotPromotionId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RescheduleSessionDto,
  ) {
    return this.promotionService.rescheduleSession(
      schoolId, slotPromotionId, sessionId, user.userId, dto.newDate,
    );
  }

  @Delete(':slotPromotionId/sessions/:sessionId')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'Cancel one session for this week — auto-confirms the promotion' })
  cancelSession(
    @Param('schoolId') schoolId: string,
    @Param('slotPromotionId') slotPromotionId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotionService.cancelWeekSession(
      schoolId, slotPromotionId, sessionId, user.userId,
    );
  }
}
