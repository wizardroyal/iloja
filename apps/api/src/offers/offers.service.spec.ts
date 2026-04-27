import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { OfferEvent, OfferEventType } from '@prisma/client';
import { OffersService } from './offers.service';

/**
 * Hand-rolled in-memory Prisma fake — same pattern as auth.service.spec.ts.
 * Captures only the slice of the API that OffersService touches.
 */
function makeFakePrisma(thread: { id: string; renterId: string; agentId: string } | null) {
  const events: OfferEvent[] = [];
  let id = 1;
  return {
    events,
    thread: {
      findUnique: async () => thread,
      update: async () => thread,
    },
    offerEvent: {
      findFirst: async ({ orderBy }: { orderBy: { createdAt: 'asc' | 'desc' } }) => {
        if (events.length === 0) return null;
        const sorted = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return orderBy.createdAt === 'desc' ? sorted[sorted.length - 1] : sorted[0];
      },
      findMany: async () => events,
      create: async ({
        data,
      }: {
        data: { threadId: string; byUserId: string; type: OfferEventType; amountKobo: bigint | null; termsSummary: string | null };
      }) => {
        const ev: OfferEvent = {
          id: `e${id++}`,
          threadId: data.threadId,
          byUserId: data.byUserId,
          type: data.type,
          amountKobo: data.amountKobo,
          termsSummary: data.termsSummary,
          createdAt: new Date(Date.now() + id),
        };
        events.push(ev);
        return ev;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

const RENTER = 'u-renter';
const AGENT = 'u-agent';
const THREAD = { id: 't1', renterId: RENTER, agentId: AGENT };

describe('OffersService', () => {
  it('renter makes the first offer; agent counters; renter accepts', async () => {
    const prisma = makeFakePrisma(THREAD);
    const svc = new OffersService(prisma as never);

    const offer = await svc.makeOffer(THREAD.id, RENTER, { amountKobo: BigInt(800_000_00) });
    expect(offer.type).toBe('offer_made');

    const counter = await svc.makeOffer(THREAD.id, AGENT, { amountKobo: BigInt(900_000_00) });
    expect(counter.type).toBe('counter_offer');

    const accepted = await svc.accept(THREAD.id, RENTER);
    expect(accepted.type).toBe('accepted');
  });

  it('rejects two consecutive offers from the same party', async () => {
    const prisma = makeFakePrisma(THREAD);
    const svc = new OffersService(prisma as never);
    await svc.makeOffer(THREAD.id, RENTER, { amountKobo: BigInt(800_000_00) });

    await expect(
      svc.makeOffer(THREAD.id, RENTER, { amountKobo: BigInt(700_000_00) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects accepting your own offer', async () => {
    const prisma = makeFakePrisma(THREAD);
    const svc = new OffersService(prisma as never);
    await svc.makeOffer(THREAD.id, RENTER, { amountKobo: BigInt(800_000_00) });

    await expect(svc.accept(THREAD.id, RENTER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects further actions after accept', async () => {
    const prisma = makeFakePrisma(THREAD);
    const svc = new OffersService(prisma as never);
    await svc.makeOffer(THREAD.id, RENTER, { amountKobo: BigInt(800_000_00) });
    await svc.accept(THREAD.id, AGENT);

    await expect(
      svc.makeOffer(THREAD.id, RENTER, { amountKobo: BigInt(700_000_00) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only the offerer can withdraw', async () => {
    const prisma = makeFakePrisma(THREAD);
    const svc = new OffersService(prisma as never);
    await svc.makeOffer(THREAD.id, RENTER, { amountKobo: BigInt(800_000_00) });

    await expect(svc.withdraw(THREAD.id, AGENT)).rejects.toBeInstanceOf(ForbiddenException);
    const withdrawn = await svc.withdraw(THREAD.id, RENTER);
    expect(withdrawn.type).toBe('withdrawn');
  });
});
