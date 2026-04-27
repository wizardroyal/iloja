import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Dispute, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ESCROW_CUSTODIAN_PROVIDER,
  type EscrowCustodianProvider,
} from '../providers/escrow/escrow-custodian.provider';

/**
 * Admin-side dispute adjudication. The renter or agent opens disputes via
 * EscrowService.openDispute; this service is what the ops team uses to
 * resolve them. Outcomes flow through to the underlying escrow:
 *   resolved_payer  → custodian refunds the renter
 *   resolved_payee  → custodian releases to the agent (1.5% fee)
 */
@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ESCROW_CUSTODIAN_PROVIDER) private readonly custodian: EscrowCustodianProvider,
  ) {}

  async listOpen(): Promise<Dispute[]> {
    return this.prisma.dispute.findMany({
      where: { status: { in: ['open', 'evidence'] } },
      orderBy: { createdAt: 'asc' },
      include: { escrow: true },
    });
  }

  async findById(id: string): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { escrow: true },
    });
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);
    return dispute;
  }

  async decide(
    id: string,
    inFavorOf: 'payer' | 'payee',
    decisionNotes: string,
  ): Promise<Dispute> {
    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id },
        include: { escrow: true },
      });
      if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);
      if (dispute.status === 'resolved_payer' || dispute.status === 'resolved_payee') {
        throw new BadRequestException(`already ${dispute.status}`);
      }
      if (dispute.escrow.state !== 'disputed') {
        throw new BadRequestException(`escrow is ${dispute.escrow.state}; expected disputed`);
      }
      if (!dispute.escrow.custodianRef) {
        throw new BadRequestException('escrow has no custodian ref');
      }

      const newDisputeStatus = inFavorOf === 'payer' ? 'resolved_payer' : 'resolved_payee';
      const newEscrowState = inFavorOf === 'payer' ? 'refunded' : 'released';
      const releaseAmount =
        inFavorOf === 'payer'
          ? dispute.escrow.amountKobo
          : dispute.escrow.amountKobo - dispute.escrow.feeKobo;

      // Settle with the custodian first; if it fails the transaction rolls
      // back and the dispute stays open for retry.
      if (inFavorOf === 'payer') {
        await this.custodian.refund({
          custodianRef: dispute.escrow.custodianRef,
          amountKobo: releaseAmount,
          reference: `dispute:${id}`,
        });
      } else {
        await this.custodian.release({
          custodianRef: dispute.escrow.custodianRef,
          amountKobo: releaseAmount,
          recipient: { bankCode: '', accountNumber: '' },
          reference: `dispute:${id}`,
        });
      }

      const updatedDispute = await tx.dispute.update({
        where: { id },
        data: {
          status: newDisputeStatus,
          decisionNotes,
          resolvedAt: new Date(),
        },
      });

      await this.transitionEscrow(tx, dispute.escrow.id, newEscrowState);

      this.logger.log(`Dispute ${id} resolved → ${newDisputeStatus}`);
      return updatedDispute;
    });
  }

  private async transitionEscrow(
    tx: Prisma.TransactionClient,
    escrowId: string,
    to: 'refunded' | 'released',
  ): Promise<void> {
    const escrow = await tx.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new NotFoundException(`Escrow ${escrowId} disappeared`);
    await tx.escrow.update({
      where: { id: escrowId },
      data: { state: to, resolvedAt: new Date() },
    });
    await tx.escrowEvent.create({
      data: {
        escrowId,
        fromState: escrow.state,
        toState: to,
        reason: 'dispute_decision',
      },
    });
  }
}
