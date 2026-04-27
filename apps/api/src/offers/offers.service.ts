import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { NotificationKind, OfferEvent, OfferEventType, Thread } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * State machine for offers within a thread:
 *
 *   (none) → offer_made
 *   offer_made / counter_offer → counter_offer | accepted | declined | withdrawn
 *   accepted / declined / withdrawn → terminal
 *
 * Counter-offers must alternate parties — a renter can't counter their own
 * counter-offer; agent must respond first.
 */
@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(threadId: string, userId: string): Promise<OfferEvent[]> {
    await this.assertParticipant(threadId, userId);
    return this.prisma.offerEvent.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async makeOffer(
    threadId: string,
    userId: string,
    input: { amountKobo: bigint; termsSummary?: string },
  ): Promise<OfferEvent> {
    await this.assertParticipant(threadId, userId);
    const last = await this.latest(threadId);
    if (last && !this.isOpen(last.type)) {
      throw new BadRequestException(`offer thread already ${last.type}`);
    }
    if (last && last.byUserId === userId) {
      throw new BadRequestException('wait for the other party to respond');
    }
    const type: OfferEventType = last ? 'counter_offer' : 'offer_made';
    return this.append(threadId, userId, {
      type,
      amountKobo: input.amountKobo,
      termsSummary: input.termsSummary ?? null,
    });
  }

  async accept(threadId: string, userId: string): Promise<OfferEvent> {
    return this.terminal(threadId, userId, 'accepted');
  }

  async decline(threadId: string, userId: string): Promise<OfferEvent> {
    return this.terminal(threadId, userId, 'declined');
  }

  async withdraw(threadId: string, userId: string): Promise<OfferEvent> {
    await this.assertParticipant(threadId, userId);
    const last = await this.latest(threadId);
    if (!last) throw new BadRequestException('no offer to withdraw');
    if (!this.isOpen(last.type)) {
      throw new BadRequestException(`offer is ${last.type}`);
    }
    if (last.byUserId !== userId) {
      throw new ForbiddenException('only the offerer can withdraw');
    }
    return this.append(threadId, userId, { type: 'withdrawn', amountKobo: null, termsSummary: null });
  }

  // ───── internals ─────

  private async terminal(
    threadId: string,
    userId: string,
    type: 'accepted' | 'declined',
  ): Promise<OfferEvent> {
    await this.assertParticipant(threadId, userId);
    const last = await this.latest(threadId);
    if (!last) throw new BadRequestException('no offer to act on');
    if (!this.isOpen(last.type)) {
      throw new BadRequestException(`offer is ${last.type}`);
    }
    if (last.byUserId === userId) {
      throw new BadRequestException(`cannot ${type} your own offer`);
    }
    return this.append(threadId, userId, {
      type,
      amountKobo: null,
      termsSummary: null,
    });
  }

  private async append(
    threadId: string,
    userId: string,
    data: { type: OfferEventType; amountKobo: bigint | null; termsSummary: string | null },
  ): Promise<OfferEvent> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    const recipientId = thread.renterId === userId ? thread.agentId : thread.renterId;
    return this.prisma.$transaction(async (tx) => {
      await tx.thread.update({
        where: { id: threadId },
        data: { lastActiveAt: new Date() },
      });
      const event = await tx.offerEvent.create({
        data: { threadId, byUserId: userId, ...data },
      });
      const kindByType: Record<OfferEventType, NotificationKind> = {
        offer_made: 'offer_made',
        counter_offer: 'offer_countered',
        accepted: 'offer_accepted',
        declined: 'offer_declined',
        withdrawn: 'offer_made',
      };
      const titleByType: Record<OfferEventType, string> = {
        offer_made: 'New offer',
        counter_offer: 'Counter-offer',
        accepted: 'Offer accepted',
        declined: 'Offer declined',
        withdrawn: 'Offer withdrawn',
      };
      await this.notifications.notify({
        userId: recipientId,
        kind: kindByType[data.type],
        title: titleByType[data.type],
        body:
          data.amountKobo !== null
            ? `₦${(Number(data.amountKobo) / 100).toLocaleString('en-NG')}`
            : `Update on your offer`,
        href: `/chat/${threadId}`,
        contextRef: threadId,
        tx,
      });
      return event;
    });
  }

  private async latest(threadId: string): Promise<OfferEvent | null> {
    return this.prisma.offerEvent.findFirst({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isOpen(type: OfferEventType): boolean {
    return type === 'offer_made' || type === 'counter_offer';
  }

  private async assertParticipant(threadId: string, userId: string): Promise<Thread> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    if (thread.renterId !== userId && thread.agentId !== userId) {
      throw new ForbiddenException('not a participant');
    }
    return thread;
  }
}
