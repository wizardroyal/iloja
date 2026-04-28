import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
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

/**
 * Internal endpoint the worker calls hourly to flip past-period active
 * subscriptions to expired. Mounted on its own controller so the path
 * can sit outside the user-facing `/subscriptions` namespace and avoid
 * the auth guard.
 */
@Controller('internal/subscriptions')
export class InternalSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post('sweep-expired')
  @HttpCode(200)
  async sweepExpired(
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<{ expired: number }> {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
    return this.subscriptions.sweepExpired();
  }
}
