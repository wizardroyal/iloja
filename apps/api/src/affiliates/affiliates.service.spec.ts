import { NotFoundException } from '@nestjs/common';
import type { Affiliate, AffiliateClick } from '@prisma/client';
import { AffiliatesService } from './affiliates.service';

function makeFakePrisma() {
  const affiliates: Affiliate[] = [];
  const clicks: AffiliateClick[] = [];
  let id = 1;
  return {
    affiliates,
    clicks,
    affiliate: {
      findMany: async ({
        where,
      }: {
        where: { active: boolean; category?: Affiliate['category'] };
      }) =>
        affiliates
          .filter((a) => a.active === where.active)
          .filter((a) => (where.category ? a.category === where.category : true))
          .sort((a, b) => a.rank - b.rank),
      findUnique: async ({ where }: { where: { id: string } }) =>
        affiliates.find((a) => a.id === where.id) ?? null,
      create: async ({
        data,
      }: {
        data: Omit<Affiliate, 'id' | 'createdAt' | 'updatedAt' | 'active' | 'rank'> & {
          rank?: number;
        };
      }) => {
        const a: Affiliate = {
          id: `a${id++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          active: true,
          rank: data.rank ?? 100,
          ...data,
        } as Affiliate;
        affiliates.push(a);
        return a;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Affiliate>;
      }) => {
        const a = affiliates.find((x) => x.id === where.id);
        if (!a) throw new Error('not found');
        Object.assign(a, data);
        return a;
      },
    },
    affiliateClick: {
      create: async ({
        data,
      }: {
        data: Omit<AffiliateClick, 'id' | 'createdAt'>;
      }) => {
        const c: AffiliateClick = {
          id: `c${id++}`,
          createdAt: new Date(),
          ...data,
        } as AffiliateClick;
        clicks.push(c);
        return c;
      },
      count: async ({
        where,
      }: {
        where: { affiliateId: string; createdAt: { gt: Date } };
      }) =>
        clicks.filter(
          (c) => c.affiliateId === where.affiliateId && c.createdAt > where.createdAt.gt,
        ).length,
    },
  };
}

describe('AffiliatesService', () => {
  it('lists only active partners filtered by category', async () => {
    const prisma = makeFakePrisma();
    const svc = new AffiliatesService(prisma as never);
    await svc.create({ category: 'movers', name: 'A', blurb: 'aaa', url: 'https://a' });
    const inactive = await svc.create({
      category: 'movers',
      name: 'B',
      blurb: 'bbb',
      url: 'https://b',
    });
    await svc.create({ category: 'internet', name: 'C', blurb: 'ccc', url: 'https://c' });
    await svc.setActive(inactive.id, false);

    const movers = await svc.listActive('movers');
    expect(movers.map((a) => a.name)).toEqual(['A']);

    const all = await svc.listActive();
    expect(all.map((a) => a.name).sort()).toEqual(['A', 'C']);
  });

  it('records a click and returns the redirect URL', async () => {
    const prisma = makeFakePrisma();
    const svc = new AffiliatesService(prisma as never);
    const a = await svc.create({
      category: 'cleaning',
      name: 'CleanCo',
      blurb: 'sparkle',
      url: 'https://cleanco.example?ref=iloja',
    });
    const result = await svc.recordClick({ affiliateId: a.id, userId: 'u1', contextRef: 'esc-1' });
    expect(result.redirect).toBe('https://cleanco.example?ref=iloja');
    expect(prisma.clicks).toHaveLength(1);
    expect(prisma.clicks[0]!.userId).toBe('u1');
  });

  it('rejects a click on an inactive partner', async () => {
    const prisma = makeFakePrisma();
    const svc = new AffiliatesService(prisma as never);
    const a = await svc.create({
      category: 'cleaning',
      name: 'CleanCo',
      blurb: 'sparkle',
      url: 'https://cleanco.example',
    });
    await svc.setActive(a.id, false);
    await expect(svc.recordClick({ affiliateId: a.id })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('counts only recent clicks in clickStats', async () => {
    const prisma = makeFakePrisma();
    const svc = new AffiliatesService(prisma as never);
    const a = await svc.create({
      category: 'internet',
      name: 'Spectranet',
      blurb: 'fast',
      url: 'https://spectranet.example',
    });
    await svc.recordClick({ affiliateId: a.id });
    await svc.recordClick({ affiliateId: a.id });
    const stats = await svc.clickStats(a.id);
    expect(stats.count).toBe(2);
  });
});
