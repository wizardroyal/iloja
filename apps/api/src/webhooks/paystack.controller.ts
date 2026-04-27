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
import { EscrowService } from '../escrow/escrow.service';
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
  };
}

/**
 * Paystack collection webhook. Idempotency comes from the escrow state
 * machine — re-delivering the same `charge.success` event a hundred times
 * still results in exactly one `markFunded` transition.
 *
 * Real signature verification (HMAC SHA-512 with the provider's secret)
 * happens via the PaymentsProvider so swapping vendors doesn't ripple here.
 */
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);

  constructor(
    private readonly escrow: EscrowService,
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
    if (body.event !== 'charge.success') {
      this.logger.log(`Ignoring Paystack event ${body.event ?? '(unknown)'}`);
      return { ok: true };
    }
    const reference = body.data?.reference;
    if (!reference) throw new BadRequestException('missing reference');
    if (body.data?.status !== 'success') {
      this.logger.warn(`Charge for ${reference} not success: ${body.data?.status}`);
      return { ok: true };
    }
    await this.escrow.markFunded(reference);
    return { ok: true };
  }
}
