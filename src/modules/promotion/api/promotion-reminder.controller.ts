import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantScope } from '@common/decorators/tenant-scope.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { AuthenticatedUser } from '@common/types/authenticated-request';
import { PromotionRepository } from '../infrastructure/promotion.repository';

@ApiTags('promotion-reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('schools/:schoolId/promotion-reminders')
export class PromotionReminderController {
  constructor(private readonly promotionRepo: PromotionRepository) {}

  @Get()
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'Poll unread timetable promotion reminders for the current lecturer' })
  getUnread(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotionRepo.findUnreadRemindersForLecturer(user.userId, schoolId);
  }

  @Patch(':reminderId/read')
  @TenantScope({ level: 'school' })
  @Roles('lecturer')
  @ApiOperation({ summary: 'Mark a promotion reminder as read' })
  markRead(
    @Param('reminderId') reminderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotionRepo.markReminderRead(reminderId, user.userId);
  }
}
