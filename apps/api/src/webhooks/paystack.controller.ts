import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from '../escrow/escrow.service';
import { PayoutsService } from '../payouts/payouts.service';
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from '../providers/payments/payments.provider';

interface PaystackWebhookEvent {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    /** Subscription/transfer payloads use these. */
    transfer_code?: string;
    subscription_code?: string;
    customer?: { customer_code?: string; email?: string };
    plan?: { plan_code?: string };
  };
}

/**
 * Paystack webhook. Routes by event type:
 *   charge.success                → escrow.markFunded
 *   transfer.success / failed     → payouts settled / failed
 *   subscription.create           → noop (Subscription row already 'active'
 *                                    at start; we just stash the
 *                                    providerRef for reconciliation)
 *   subscription.disable          → flip Subscription.status to cancelled
 *   subscription.not_renew        → Subscription.status stays active
 *                                    until currentPeriodEnd, then expires
 *
 * Idempotency comes from the underlying state machines — re-delivering the
 * same event is always safe.
 */
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly payouts: PayoutsService,
    @Inject(PAYMENTS_PROVIDER) private readonly payments: PaymentsProvider,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Body() body: PaystackWebhookEvent,
    @Headers('x-paystack-signature') signature: string | undefined,
  ): Promise<{ ok: true }> {
    const rawBody = JSON.stringify(body);
    if (!this.payments.verifyWebhookSignature(rawBody, signature ?? '')) {
      throw new UnauthorizedException('invalid signature');
    }
    const event = body.event ?? '';
    switch (event) {
      case 'charge.success':
        return this.handleChargeSuccess(body);
      case 'transfer.success':
      case 'transfer.failed':
        return this.handleTransferUpdate(body, event);
      case 'subscription.create':
        return this.handleSubscriptionCreate(body);
      case 'subscription.disable':
      case 'subscription.not_renew':
        return this.handleSubscriptionDisable(body, event);
      default:
        this.logger.log(`Ignoring Paystack event ${event || '(unknown)'}`);
        return { ok: true };
    }
  }

  private async handleChargeSuccess(body: PaystackWebhookEvent): Promise<{ ok: true }> {
    const reference = body.data?.reference;
    if (!reference) throw new BadRequestException('missing reference');
    if (body.data?.status !== 'success') {
      this.logger.warn(`Charge for ${reference} not success: ${body.data?.status}`);
      return { ok: true };
    }
    await this.escrow.markFunded(reference);
    return { ok: true };
  }

  private async handleTransferUpdate(
    body: PaystackWebhookEvent,
    event: string,
  ): Promise<{ ok: true }> {
    const ref = body.data?.transfer_code ?? body.data?.reference;
    if (!ref) {
      this.logger.warn('Transfer webhook missing reference');
      return { ok: true };
    }
    if (event === 'transfer.success') {
      await this.payouts.markSettledByProviderRef(ref);
    } else {
      const payout = await this.prisma.payout.findFirst({
        where: { providerRef: ref },
      });
      if (payout && payout.status !== 'failed') {
        await this.prisma.payout.update({
          where: { id: payout.id },
          data: { status: 'failed', failureReason: 'transfer.failed webhook' },
        });
      }
    }
    return { ok: true };
  }

  private async handleSubscriptionCreate(body: PaystackWebhookEvent): Promise<{ ok: true }> {
    // The reference field on subscription.create is our internal subscription
    // id (we set it as the reference when we initiated collection). Stash the
    // Paystack subscription_code for later reconciliation.
    const subId = body.data?.reference;
    const subscriptionCode = body.data?.subscription_code;
    if (!subId || !subscriptionCode) return { ok: true };
    const sub = await this.prisma.subscription.findUnique({ where: { id: subId } });
    if (!sub) return { ok: true };
    if (sub.providerRef === subscriptionCode) return { ok: true };
    await this.prisma.subscription.update({
      where: { id: subId },
      data: { providerRef: subscriptionCode },
    });
    return { ok: true };
  }

  private async handleSubscriptionDisable(
    body: PaystackWebhookEvent,
    event: string,
  ): Promise<{ ok: true }> {
    const subscriptionCode = body.data?.subscription_code;
    if (!subscriptionCode) return { ok: true };
    const sub = await this.prisma.subscription.findFirst({
      where: { providerRef: subscriptionCode },
    });
    if (!sub) return { ok: true };
    if (sub.status === 'cancelled' || sub.status === 'expired') return { ok: true };
    // disable = stop now; not_renew = stop at period end. We honour both by
    // flipping `cancelled` immediately for disable and leaving status alone
    // for not_renew (cron will sweep `currentPeriodEnd < now AND active`
    // → expired in a follow-up pass).
    if (event === 'subscription.disable') {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
    } else {
      this.logger.log(`Subscription ${sub.id} marked not-renew; will expire at period end`);
    }
    return { ok: true };
  }
}
