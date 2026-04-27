import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Affiliate, AffiliateCategory, AffiliateClick } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Curated affiliate partners (doc §6 Tier 2 from Month 6: movers /
 * internet / DSTV / cleaning). Renters see them at the move-in moment —
 * "perfectly timed and require no additional acquisition cost".
 *
 * Click tracking is intentionally simple: one row per click. We
 * reconcile against partner reports for actual commission attribution
 * outside this service.
 */
@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listActive(category?: AffiliateCategory): Promise<Affiliate[]> {
    return this.prisma.affiliate.findMany({
      where: {
        active: true,
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: 'asc' }, { rank: 'asc' }],
    });
  }

  async create(input: {
    category: AffiliateCategory;
    name: string;
    blurb: string;
    url: string;
    rank?: number;
  }): Promise<Affiliate> {
    return this.prisma.affiliate.create({
      data: {
        category: input.category,
        name: input.name,
        blurb: input.blurb,
        url: input.url,
        rank: input.rank ?? 100,
      },
    });
  }

  async setActive(id: string, active: boolean): Promise<Affiliate> {
    const a = await this.prisma.affiliate.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Affiliate ${id} not found`);
    return this.prisma.affiliate.update({
      where: { id },
      data: { active },
    });
  }

  async recordClick(input: {
    affiliateId: string;
    userId?: string | null;
    contextRef?: string | null;
  }): Promise<{ click: AffiliateClick; redirect: string }> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: input.affiliateId },
    });
    if (!affiliate || !affiliate.active) {
      throw new NotFoundException(`Affiliate ${input.affiliateId} not active`);
    }
    const click = await this.prisma.affiliateClick.create({
      data: {
        affiliateId: input.affiliateId,
        userId: input.userId ?? null,
        contextRef: input.contextRef ?? null,
      },
    });
    return { click, redirect: affiliate.url };
  }

  async clickStats(affiliateId: string, sinceDays = 30): Promise<{ count: number }> {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const count = await this.prisma.affiliateClick.count({
      where: { affiliateId, createdAt: { gt: since } },
    });
    return { count };
  }
}
