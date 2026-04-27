import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QUEUES } from '@iloja/types';
import type { Escrow, EscrowKind, EscrowState, Prisma } from '@prisma/client';
import { haversineMetres } from '../common/geo';
import { CredibilityService } from '../credibility/credibility.service';
import { DocumentsService } from '../documents/documents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ESCROW_CUSTODIAN_PROVIDER,
  type EscrowCustodianProvider,
} from '../providers/escrow/escrow-custodian.provider';
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from '../providers/payments/payments.provider';
import { QueueProducer } from '../queue/queue.producer';

/** Iloja's flat 1.5% fee, charged to the receiving party. */
const FEE_BPS = BigInt(150); // 1.5% = 150 / 10_000
const BPS_DIVISOR = BigInt(10_000);

/** GPS check-in window for inspection-fee escrow per the doc: 100 metres. */
const GPS_CHECK_IN_RADIUS_M = 100;

/** Auto-release windows. Match what's promised on the listing detail copy. */
const SHORT_LET_AUTO_RELEASE_HOURS = 24;
const LONG_TERM_MOVE_IN_HOURS = 48;

/**
 * Inspection-fee escrow. Matches the doc:
 *   "the single most powerful renter acquisition moment on the platform."
 *
 * Lifecycle:
 *   created  → custodian trust account opened, payment URL generated
 *   funded   → Paystack webhook acknowledged, custodian holds the funds
 *   (renter checks in at property, server validates GPS)
 *   released → renter taps Confirm → custodian releases to agent (1.5% fee)
 *   refunded → renter taps Dispute → custodian refunds renter
 *   disputed → frozen for admin adjudication
 *
 * Every transition is event-sourced (EscrowEvent). Idempotency is enforced
 * by checking the current state before transitioning.
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueProducer,
    private readonly credibility: CredibilityService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENTS_PROVIDER) private readonly payments: PaymentsProvider,
    @Inject(ESCROW_CUSTODIAN_PROVIDER) private readonly custodian: EscrowCustodianProvider,
  ) {}

  // ────────── Inspection-fee escrow ──────────

  /**
   * Renter triggers this from the inspection-detail screen. Computes the
   * fee, opens a trust account at the custodian, returns a Paystack payment
   * URL the renter completes externally. The funded transition happens via
   * the Paystack webhook.
   */
  async createForInspection(
    inspectionId: string,
    renterId: string,
  ): Promise<{ escrow: Escrow; authorizationUrl: string }> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { thread: true },
    });
    if (!inspection) throw new NotFoundException(`Inspection ${inspectionId} not found`);
    if (inspection.forUserId !== renterId) {
      throw new ForbiddenException('only the renter can fund the inspection');
    }
    if (inspection.status !== 'confirmed') {
      throw new BadRequestException(`inspection is ${inspection.status}; must be confirmed`);
    }

    // Already an open escrow on this inspection? Return it idempotently.
    const existing = await this.prisma.escrow.findFirst({
      where: {
        listingId: inspection.listingId,
        kind: 'inspection_fee',
        payerId: renterId,
        state: { in: ['created', 'funded'] },
      },
    });
    if (existing) {
      const { authorizationUrl } = await this.payments.initiateCollection({
        amountKobo: existing.amountKobo,
        reference: existing.id,
        customer: { phone: '' },
      });
      return { escrow: existing, authorizationUrl };
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: inspection.listingId },
    });
    if (!listing) throw new NotFoundException('listing missing');
    const amountKobo = inspectionFeeFor(listing.priceKobo);
    const feeKobo = (amountKobo * FEE_BPS) / BPS_DIVISOR;

    return this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.create({
        data: {
          kind: 'inspection_fee',
          state: 'created',
          payerId: renterId,
          payeeId: inspection.byUserId,
          listingId: inspection.listingId,
          amountKobo,
          feeKobo,
        },
      });
      await tx.escrowEvent.create({
        data: {
          escrowId: escrow.id,
          fromState: 'created',
          toState: 'created',
          actorUserId: renterId,
          reason: 'created',
        },
      });
      const trust = await this.custodian.openTrustAccount({
        escrowId: escrow.id,
        expectedAmountKobo: amountKobo,
      });
      const updated = await tx.escrow.update({
        where: { id: escrow.id },
        data: { custodianRef: trust.custodianRef },
      });
      const init = await this.payments.initiateCollection({
        amountKobo,
        reference: escrow.id,
        customer: { phone: '' },
      });
      return { escrow: updated, authorizationUrl: init.authorizationUrl };
    });
  }

  /**
   * Paystack webhook handler. Idempotent: if the escrow is already funded we
   * return the same row without re-firing release timers.
   */
  async markFunded(escrowId: string): Promise<Escrow> {
    return this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({ where: { id: escrowId } });
      if (!escrow) throw new NotFoundException(`Escrow ${escrowId} not found`);
      if (escrow.state === 'funded') return escrow;
      if (escrow.state !== 'created') {
        throw new BadRequestException(`cannot fund escrow in state ${escrow.state}`);
      }
      const updated = await this.transition(tx, escrow, 'funded', null, {
        fundedAt: new Date(),
      });
      await this.notifications.notify({
        userId: escrow.payerId,
        kind: 'escrow_funded',
        title: 'Escrow funded',
        body: 'Your inspection fee is held. Show up at the property to confirm.',
        href: `/escrow/${escrow.id}`,
        contextRef: escrow.id,
        tx,
      });
      await this.notifications.notify({
        userId: escrow.payeeId,
        kind: 'escrow_funded',
        title: 'Inspection fee funded',
        body: 'Renter has paid into escrow.',
        href: `/escrow/${escrow.id}`,
        contextRef: escrow.id,
        tx,
      });
      this.logger.log(`Escrow ${escrowId} funded`);
      return updated;
    });
  }

  /**
   * Renter at the property taps "I'm here". We validate GPS, then unlock
   * the confirm/dispute UI. State doesn't transition here — only the
   * subsequent confirm/dispute call moves the escrow.
   */
  async checkIn(
    escrowId: string,
    userId: string,
    point: { lat: number; lng: number },
  ): Promise<{ ok: true }> {
    const escrow = await this.prisma.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new NotFoundException(`Escrow ${escrowId} not found`);
    if (escrow.payerId !== userId) throw new ForbiddenException('not your escrow');
    if (escrow.state !== 'funded') {
      throw new BadRequestException(`escrow is ${escrow.state}; must be funded`);
    }
    if (!escrow.listingId) throw new BadRequestException('escrow has no listing');
    const listing = await this.prisma.listing.findUnique({
      where: { id: escrow.listingId },
    });
    if (!listing) throw new NotFoundException('listing missing');
    const distance = haversineMetres(point, { lat: listing.lat, lng: listing.lng });
    if (distance > GPS_CHECK_IN_RADIUS_M) {
      throw new BadRequestException(
        `you appear to be ${Math.round(distance)}m from the property; must be within ${GPS_CHECK_IN_RADIUS_M}m`,
      );
    }
    return { ok: true };
  }

  async confirm(escrowId: string, userId: string): Promise<Escrow> {
    const result = await this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({ where: { id: escrowId } });
      if (!escrow) throw new NotFoundException(`Escrow ${escrowId} not found`);
      if (escrow.payerId !== userId) throw new ForbiddenException('only the payer can confirm');
      if (escrow.state !== 'funded') {
        throw new BadRequestException(`escrow is ${escrow.state}; must be funded`);
      }
      if (!escrow.custodianRef) throw new BadRequestException('escrow has no custodian ref');

      const releaseAmount = escrow.amountKobo - escrow.feeKobo;
      await this.custodian.release({
        custodianRef: escrow.custodianRef,
        amountKobo: releaseAmount,
        recipient: { bankCode: '', accountNumber: '' },
        reference: escrow.id,
      });
      const updated = await this.transition(tx, escrow, 'released', userId, {
        resolvedAt: new Date(),
      });

      // Receipt → on-chain.
      await this.documents.writeReceipt({
        type: 'escrow_receipt',
        body: {
          escrowId: updated.id,
          kind: updated.kind,
          payerId: updated.payerId,
          payeeId: updated.payeeId,
          amountKobo: updated.amountKobo.toString(),
          feeKobo: updated.feeKobo.toString(),
          custodianRef: updated.custodianRef,
          resolvedAt: updated.resolvedAt?.toISOString(),
          outcome: 'released',
        },
        contextRef: updated.id,
        tx,
      });

      // Doc §2.5: completed rentals + show-up bumps.
      await this.credibility.record({
        subjectUserId: updated.payeeId,
        factor: 'completed_rental',
        delta: 5.0,
        reason: `escrow_${updated.kind}_released`,
        contextRef: updated.id,
        tx,
      });
      await this.credibility.record({
        subjectUserId: updated.payeeId,
        factor: 'inspection_show_up',
        delta: 5.0,
        reason: `escrow_${updated.kind}_released`,
        contextRef: updated.id,
        tx,
      });

      await this.notifications.notify({
        userId: updated.payeeId,
        kind: 'escrow_released',
        title: 'Funds released',
        body: `₦${(Number(updated.amountKobo - updated.feeKobo) / 100).toLocaleString('en-NG')} on the way to your account.`,
        href: `/escrow/${updated.id}`,
        contextRef: updated.id,
        tx,
      });

      return updated;
    });
    await this.credibility.refreshAgentSnapshot(result.payeeId);

    // Score-at-time-of-deal snapshot anchored on-chain so the agent's
    // standing at this transaction is independently verifiable forever
    // ("agents and renters cannot be retroactively penalised" — doc §2.10).
    // Lives outside the transaction so the snapshot reflects the post-
    // refresh score and credibility row.
    const profile = await this.prisma.agentProfile.findUnique({
      where: { userId: result.payeeId },
    });
    if (profile) {
      await this.documents.writeReceipt({
        type: 'credibility_snapshot',
        body: {
          userId: result.payeeId,
          escrowId: result.id,
          credibilityScore: profile.credibilityScore,
          badgeTier: profile.badgeTier,
          completedRentals: profile.completedRentals,
          snapshotAt: new Date().toISOString(),
        },
        contextRef: result.id,
      });
    }
    return result;
  }

  async openDispute(
    escrowId: string,
    userId: string,
    input: { reason: string; evidenceUrls?: string[] },
  ): Promise<Escrow> {
    return this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({ where: { id: escrowId } });
      if (!escrow) throw new NotFoundException(`Escrow ${escrowId} not found`);
      if (escrow.payerId !== userId && escrow.payeeId !== userId) {
        throw new ForbiddenException('not a party to this escrow');
      }
      if (escrow.state !== 'funded') {
        throw new BadRequestException(`escrow is ${escrow.state}; must be funded`);
      }
      await tx.dispute.create({
        data: {
          escrowId: escrow.id,
          openedByUserId: userId,
          reason: input.reason,
          evidenceUrls: input.evidenceUrls ?? [],
          status: 'open',
        },
      });
      // Notify both sides — counterparty needs to know to defend, opener
      // gets confirmation that ops are aware.
      const counterpartyId = userId === escrow.payerId ? escrow.payeeId : escrow.payerId;
      await this.notifications.notify({
        userId: counterpartyId,
        kind: 'escrow_disputed',
        title: 'Escrow dispute opened',
        body: 'Iloja ops are reviewing. Please prepare any supporting evidence.',
        href: `/escrow/${escrow.id}`,
        contextRef: escrow.id,
        tx,
      });
      return this.transition(tx, escrow, 'disputed', userId, {});
    });
  }

  /**
   * Auto-release path triggered by the worker. Idempotent — if the escrow
   * is no longer in `funded` (e.g. renter confirmed manually first), we
   * silently no-op.
   */
  async autoRelease(escrowId: string): Promise<{ acted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({ where: { id: escrowId } });
      if (!escrow) return { acted: false };
      if (escrow.state !== 'funded') return { acted: false };
      if (!escrow.custodianRef) return { acted: false };
      await this.custodian.release({
        custodianRef: escrow.custodianRef,
        amountKobo: escrow.amountKobo - escrow.feeKobo,
        recipient: { bankCode: '', accountNumber: '' },
        reference: escrow.id,
      });
      await this.transition(tx, escrow, 'released', null, {
        resolvedAt: new Date(),
      });
      this.logger.log(`Escrow ${escrowId} auto-released`);
      return { acted: true };
    });
  }

  // ────────── Common helpers ──────────

  async findById(id: string, userId: string): Promise<Escrow> {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: { events: true, disputes: true },
    });
    if (!escrow) throw new NotFoundException(`Escrow ${id} not found`);
    if (escrow.payerId !== userId && escrow.payeeId !== userId) {
      throw new ForbiddenException('not a party to this escrow');
    }
    return escrow;
  }

  async findMine(userId: string): Promise<Escrow[]> {
    return this.prisma.escrow.findMany({
      where: { OR: [{ payerId: userId }, { payeeId: userId }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Schedules the kind-specific auto-release timer in BullMQ. Called when
   * an escrow funds. Uses the escrow ID as the BullMQ jobId for natural
   * idempotency — re-funding (which shouldn't happen) overwrites rather
   * than queues a duplicate.
   */
  async scheduleAutoRelease(escrow: Escrow): Promise<void> {
    let delayMs: number | null = null;
    let setAutoReleaseAt: Date | null = null;
    switch (escrow.kind) {
      case 'inspection_fee':
        // No auto-release for inspection fees — renter must confirm. Doc
        // says funds release immediately on confirm.
        return;
      case 'short_let_booking':
        delayMs = SHORT_LET_AUTO_RELEASE_HOURS * 60 * 60 * 1000;
        setAutoReleaseAt = new Date(Date.now() + delayMs);
        break;
      case 'long_term_rent':
        delayMs = LONG_TERM_MOVE_IN_HOURS * 60 * 60 * 1000;
        setAutoReleaseAt = new Date(Date.now() + delayMs);
        break;
    }
    if (delayMs === null) return;
    await this.prisma.escrow.update({
      where: { id: escrow.id },
      data: { autoReleaseAt: setAutoReleaseAt },
    });
    await this.queue.enqueue(
      QUEUES.ESCROW_TIMERS,
      'escrow.auto_release',
      { escrowId: escrow.id, kind: escrow.kind },
      { delayMs, jobId: `${escrow.id}:auto_release` },
    );
  }

  // ────────── Internals ──────────

  private async transition(
    tx: Prisma.TransactionClient,
    escrow: Escrow,
    to: EscrowState,
    actorUserId: string | null,
    extra: Partial<Pick<Escrow, 'fundedAt' | 'resolvedAt'>>,
  ): Promise<Escrow> {
    const updated = await tx.escrow.update({
      where: { id: escrow.id },
      data: { state: to, ...extra },
    });
    await tx.escrowEvent.create({
      data: {
        escrowId: escrow.id,
        fromState: escrow.state,
        toState: to,
        actorUserId,
      },
    });
    return updated;
  }
}

/**
 * Pricing rule for inspection fees. Same logic mirrored in the web layer
 * (apps/web/src/app/listings/[id]/page.tsx) — keep them in sync until we
 * extract a shared helper.
 */
export function inspectionFeeFor(listingPriceKobo: bigint): bigint {
  const onePct = listingPriceKobo / BigInt(100);
  const min = BigInt(500_000); // ₦5,000
  const max = BigInt(2_500_000); // ₦25,000
  if (onePct < min) return min;
  if (onePct > max) return max;
  return onePct;
}

export { type EscrowKind };
