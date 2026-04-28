import { Injectable } from '@nestjs/common';
import type { ListingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface MarketSnapshot {
  generatedAt: string;
  /** Active-listing density per neighborhood (top 50). */
  neighborhoods: {
    neighborhood: string;
    activeListings: number;
    medianPriceKobo: string | null;
  }[];
  /** Verified listings added per ISO month, last 12 months. */
  verifiedPerMonth: { month: string; count: number }[];
  /** Inspection completion volume per ISO month, last 12 months. */
  inspectionsPerMonth: { month: string; count: number }[];
  /** Released-escrow demand per ISO month, last 12 months. */
  escrowReleasesPerMonth: { month: string; count: number }[];
  /** Quick aggregate per type. */
  byType: {
    type: ListingType;
    activeListings: number;
    medianPriceKobo: string | null;
  }[];
}

/**
 * Doc §6 Tier 4: aggregated, anonymised price + demand data sold to
 * developers, mortgage lenders, govt. We compute on demand from the live
 * tables; no PII surfaces. Heavy queries get cached at the CDN edge in
 * production.
 */
@Injectable()
export class MarketDataService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(): Promise<MarketSnapshot> {
    const [neighborhoods, verifiedPerMonth, inspectionsPerMonth, escrowsPerMonth, byType] =
      await Promise.all([
        this.aggregateByNeighborhood(),
        this.countByMonth('listing', 'verifiedAt'),
        this.countByMonth('inspection', 'completedFlag'),
        this.countByMonth('escrow', 'released'),
        this.aggregateByType(),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      neighborhoods,
      verifiedPerMonth,
      inspectionsPerMonth,
      escrowReleasesPerMonth: escrowsPerMonth,
      byType,
    };
  }

  private async aggregateByNeighborhood(): Promise<MarketSnapshot['neighborhoods']> {
    const rows = await this.prisma.listing.findMany({
      where: { status: 'active' },
      select: { neighborhood: true, priceKobo: true },
    });
    const grouped = new Map<string, bigint[]>();
    for (const r of rows) {
      const arr = grouped.get(r.neighborhood) ?? [];
      arr.push(r.priceKobo);
      grouped.set(r.neighborhood, arr);
    }
    const out = [...grouped.entries()]
      .map(([neighborhood, prices]) => ({
        neighborhood,
        activeListings: prices.length,
        medianPriceKobo: median(prices)?.toString() ?? null,
      }))
      .sort((a, b) => b.activeListings - a.activeListings)
      .slice(0, 50);
    return out;
  }

  private async aggregateByType(): Promise<MarketSnapshot['byType']> {
    const rows = await this.prisma.listing.findMany({
      where: { status: 'active' },
      select: { type: true, priceKobo: true },
    });
    const grouped = new Map<ListingType, bigint[]>();
    for (const r of rows) {
      const arr = grouped.get(r.type) ?? [];
      arr.push(r.priceKobo);
      grouped.set(r.type, arr);
    }
    return [...grouped.entries()].map(([type, prices]) => ({
      type,
      activeListings: prices.length,
      medianPriceKobo: median(prices)?.toString() ?? null,
    }));
  }

  /**
   * Per-month count rollup keyed by either a Date column on Listing
   * (verifiedAt) or a derived event (Escrow/state=released, Inspection/
   * status=completed). 12-month rolling window.
   */
  private async countByMonth(
    table: 'listing' | 'inspection' | 'escrow',
    bucket: 'verifiedAt' | 'completedFlag' | 'released',
  ): Promise<{ month: string; count: number }[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    let rows: { ts: Date }[] = [];
    if (table === 'listing') {
      const r = await this.prisma.listing.findMany({
        where: { verifiedAt: { gt: since, not: null } },
        select: { verifiedAt: true },
      });
      rows = r
        .filter((x): x is { verifiedAt: Date } => x.verifiedAt !== null)
        .map((x) => ({ ts: x.verifiedAt }));
    } else if (table === 'inspection') {
      const r = await this.prisma.inspection.findMany({
        where: { status: 'completed', confirmedAt: { gt: since, not: null } },
        select: { confirmedAt: true },
      });
      rows = r
        .filter((x): x is { confirmedAt: Date } => x.confirmedAt !== null)
        .map((x) => ({ ts: x.confirmedAt }));
    } else {
      const r = await this.prisma.escrow.findMany({
        where: { state: 'released', resolvedAt: { gt: since, not: null } },
        select: { resolvedAt: true },
      });
      rows = r
        .filter((x): x is { resolvedAt: Date } => x.resolvedAt !== null)
        .map((x) => ({ ts: x.resolvedAt }));
    }

    const byMonth = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.ts.getUTCFullYear()}-${String(r.ts.getUTCMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    void bucket;
    return [...byMonth.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

/** Median for a list of kobo amounts; returns undefined for empty input. */
function median(values: bigint[]): bigint | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => Number(a - b));
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid];
}
