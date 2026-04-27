import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BenchmarkParams {
  type: 'short_let' | 'long_term' | 'commercial';
  neighborhood: string;
  bedrooms?: number;
}

export interface BenchmarkResult {
  type: BenchmarkParams['type'];
  neighborhood: string;
  bedrooms: number | null;
  /** Number of verified listings the percentiles are derived from. */
  sampleSize: number;
  /** Returned in kobo to keep precision. Web layer formats. */
  p25Kobo: string | null;
  medianKobo: string | null;
  p75Kobo: string | null;
}

/**
 * Computes price percentiles on demand from active, verified listings. At
 * Sprint 2 volumes the table scan is cheap; once active-listing count crosses
 * ~10K we move this into a nightly worker job and cache by (type, hood, beds).
 */
@Injectable()
export class BenchmarkService {
  constructor(private readonly prisma: PrismaService) {}

  async benchmark(params: BenchmarkParams): Promise<BenchmarkResult> {
    const rows = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        type: params.type,
        neighborhood: params.neighborhood,
        ...(params.bedrooms !== undefined ? { bedrooms: params.bedrooms } : {}),
      },
      select: { priceKobo: true },
    });
    const prices = rows.map((r) => r.priceKobo).sort((a, b) => Number(a - b));
    if (prices.length === 0) {
      return {
        type: params.type,
        neighborhood: params.neighborhood,
        bedrooms: params.bedrooms ?? null,
        sampleSize: 0,
        p25Kobo: null,
        medianKobo: null,
        p75Kobo: null,
      };
    }
    return {
      type: params.type,
      neighborhood: params.neighborhood,
      bedrooms: params.bedrooms ?? null,
      sampleSize: prices.length,
      p25Kobo: percentile(prices, 0.25).toString(),
      medianKobo: percentile(prices, 0.5).toString(),
      p75Kobo: percentile(prices, 0.75).toString(),
    };
  }
}

/** Pre-sorted percentile, nearest-rank — sufficient for benchmarking copy. */
function percentile(sorted: bigint[], p: number): bigint {
  if (sorted.length === 0) return BigInt(0);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}
