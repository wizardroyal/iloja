import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser, CurrentUserGuard, CurrentUserParam } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

const StartSubscriptionSchema = z
  .object({
    plan: z.enum(['agent_crm_basic', 'agent_crm_pro']),
  })
  .strict();

@Controller('subscriptions')
@UseGuards(CurrentUserGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('me')
  active(@CurrentUserParam() user: CurrentUser): Promise<Subscription | null> {
    return this.subscriptions.myActive(user.id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(StartSubscriptionSchema))
  start(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: { plan: 'agent_crm_basic' | 'agent_crm_pro' },
  ): Promise<{ subscription: Subscription; authorizationUrl: string }> {
    return this.subscriptions.start(user.id, body.plan);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<Subscription> {
    return this.subscriptions.cancel(id, user.id);
  }
}
