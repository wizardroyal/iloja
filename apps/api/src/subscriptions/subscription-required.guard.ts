import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Hard paywall guard. The doc names this as one of the deepest stickiness
 * factors for agents — features behind it should be the ones that shift
 * agents' daily workflow onto Iloja (lead pipeline detail, advanced
 * analytics, scheduling). Pair with CurrentUserGuard so req.user exists.
 */
@Injectable()
export class SubscriptionRequiredGuard implements CanActivate {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) throw new ForbiddenException('not signed in');
    const ok = await this.subscriptions.hasActive(req.user.id);
    if (!ok) {
      throw new ForbiddenException(
        'agent CRM subscription required — start one at POST /subscriptions',
      );
    }
    return true;
  }
}
