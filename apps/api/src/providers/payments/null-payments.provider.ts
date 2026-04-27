import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  CollectionInitResult,
  CollectionRequest,
  CollectionStatus,
  PaymentsProvider,
  PayoutRequest,
  PayoutResult,
} from './payments.provider';

/**
 * Sprint-4 stand-in. Implements just enough of the contract for development:
 * - initiateCollection returns a fake authorization URL that the web client
 *   can "complete" by hitting the dev /webhooks/paystack/test endpoint.
 * - verifyCollection always returns success after a small delay simulation.
 *   Replace with PaystackPaymentsProvider once env config is wired.
 *
 * verifyWebhookSignature returns true for anything in dev so the test webhook
 * endpoint doesn't get stuck during local work.
 */
@Injectable()
export class NullPaymentsProvider implements PaymentsProvider {
  private readonly logger = new Logger(NullPaymentsProvider.name);

  async initiateCollection(input: CollectionRequest): Promise<CollectionInitResult> {
    this.logger.warn(
      `NullPayments collecting ₦${(Number(input.amountKobo) / 100).toLocaleString()} ref=${input.reference}`,
    );
    return {
      reference: input.reference,
      authorizationUrl: `https://stub.iloja.local/pay/${input.reference}`,
    };
  }

  async verifyCollection(_reference: string): Promise<CollectionStatus> {
    return { status: 'success', paidAt: new Date().toISOString() };
  }

  async payout(input: PayoutRequest): Promise<PayoutResult> {
    return {
      reference: input.reference,
      providerRef: `null-payout-${randomBytes(6).toString('hex')}`,
      status: 'queued',
    };
  }

  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}
