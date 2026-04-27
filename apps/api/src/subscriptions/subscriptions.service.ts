import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Subscription, SubscriptionPlan } from '@prisma/client';
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from '../providers/payments/payments.provider';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_PRICES_KOBO: Record<SubscriptionPlan, bigint> = {
  // ₦15K basic / ₦25K pro per the doc §3.2 + §6 Tier 2.
  agent_crm_basic: BigInt(1_500_000),
  agent_crm_pro: BigInt(2_500_000),
};

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Agent CRM subscription (doc §6 Tier 2 from Month 6). Iloja-side row is
 * the source of truth; the providerRef ties it to a Paystack subscription
 * object once that integration lands. Until then, subscriptions go straight
 * to `active` with the next-month renewal so the paywall can be exercised
 * end-to-end.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENTS_PROVIDER) private readonly payments: PaymentsProvider,
  ) {}

  async start(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<{ subscription: Subscription; authorizationUrl: string }> {
    const amountKobo = PLAN_PRICES_KOBO[plan];
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        plan,
        amountKobo,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + ONE_MONTH_MS),
      },
    });
    const init = await this.payments.initiateCollection({
      amountKobo,
      reference: subscription.id,
      customer: { phone: '' },
    });
    return { subscription, authorizationUrl: init.authorizationUrl };
  }

  async cancel(id: string, userId: string): Promise<Subscription> {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException(`Subscription ${id} not found`);
    if (sub.userId !== userId) throw new NotFoundException(`Subscription ${id} not found`);
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
  }

  async myActive(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        currentPeriodEnd: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Hard paywall predicate. Used by SubscriptionRequiredGuard. */
  async hasActive(userId: string): Promise<boolean> {
    const count = await this.prisma.subscription.count({
      where: {
        userId,
        status: 'active',
        currentPeriodEnd: { gt: new Date() },
      },
    });
    return count > 0;
  }
}
