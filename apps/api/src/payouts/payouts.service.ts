import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Payout, PayoutKind, Prisma, UserBankAccount } from '@prisma/client';
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from '../providers/payments/payments.provider';
import { PrismaService } from '../prisma/prisma.service';

/** Per-verified-listing operator pay. Doc §2.3 phase 1. */
const OPERATOR_PER_LISTING_KOBO = BigInt(2_500_00); // ₦2,500

/**
 * Outbound payouts to operators / agents / landlords. Persist-then-call so a
 * partial failure leaves a `queued` row we can retry from rather than a
 * silent loss. The actual transfer happens via PaymentsProvider.payout —
 * NullPaymentsProvider returns `queued` deterministically; the real
 * Paystack impl will return immediately and a webhook flips us to
 * `succeeded` later.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENTS_PROVIDER) private readonly payments: PaymentsProvider,
  ) {}

  async setBankAccount(
    userId: string,
    input: { bankCode: string; accountNumber: string; accountName: string },
  ): Promise<UserBankAccount> {
    return this.prisma.userBankAccount.upsert({
      where: { userId },
      create: {
        userId,
        bankCode: input.bankCode,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
      },
      update: {
        bankCode: input.bankCode,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        verifiedAt: null,
      },
    });
  }

  async getBankAccount(userId: string): Promise<UserBankAccount | null> {
    return this.prisma.userBankAccount.findUnique({ where: { userId } });
  }

  async listMyPayouts(userId: string): Promise<Payout[]> {
    return this.prisma.payout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Operator payout for an approved verification job. Idempotent on
   * contextRef so retrying an approval doesn't double-pay. Skips silently
   * (no exception) if the operator has no bank account on file — admins
   * see the row sitting in `queued` and can chase the operator.
   */
  async queueForVerification(input: {
    operatorId: string;
    verificationJobId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<Payout | null> {
    const client = input.tx ?? this.prisma;
    const existing = await client.payout.findFirst({
      where: { contextRef: input.verificationJobId, kind: 'operator_verification' },
    });
    if (existing) return existing;
    return client.payout.create({
      data: {
        userId: input.operatorId,
        kind: 'operator_verification',
        amountKobo: OPERATOR_PER_LISTING_KOBO,
        contextRef: input.verificationJobId,
        status: 'queued',
      },
    });
  }

  /**
   * Worker calls this for every queued payout. Loads the bank account,
   * dispatches via the provider, advances state. Idempotent — re-running on
   * a `succeeded` row is a no-op.
   */
  async dispatch(payoutId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException(`Payout ${payoutId} not found`);
    if (payout.status !== 'queued') return payout;
    const bank = await this.prisma.userBankAccount.findUnique({
      where: { userId: payout.userId },
    });
    if (!bank) {
      this.logger.warn(`Payout ${payoutId} skipped — no bank account for ${payout.userId}`);
      return payout;
    }
    try {
      const result = await this.payments.payout({
        amountKobo: payout.amountKobo,
        reference: payout.id,
        recipient: {
          bankCode: bank.bankCode,
          accountNumber: bank.accountNumber,
          accountName: bank.accountName,
        },
      });
      const updated = await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          providerRef: result.providerRef,
          status: result.status === 'success' ? 'succeeded' : 'queued',
          settledAt: result.status === 'success' ? new Date() : null,
        },
      });
      return updated;
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Payout ${payoutId} failed: ${message}`);
      return this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'failed', failureReason: message },
      });
    }
  }

  async listQueued(): Promise<Payout[]> {
    return this.prisma.payout.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async markSettledByProviderRef(providerRef: string): Promise<Payout | null> {
    const payout = await this.prisma.payout.findFirst({ where: { providerRef } });
    if (!payout) return null;
    if (payout.status === 'succeeded') return payout;
    return this.prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'succeeded', settledAt: new Date() },
    });
  }

  /**
   * Useful for manual admin retries of failed payouts.
   */
  async requeue(payoutId: string): Promise<Payout> {
    const p = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!p) throw new NotFoundException(`Payout ${payoutId} not found`);
    if (p.status !== 'failed') {
      throw new BadRequestException(`payout is ${p.status}, not failed`);
    }
    return this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'queued', failureReason: null },
    });
  }

  /** Payout kind helper for callers that just need the standard agent/landlord one. */
  static escrowKindFor(role: 'agent' | 'landlord'): PayoutKind {
    return role === 'agent' ? 'agent_escrow_release' : 'landlord_escrow_release';
  }
}
