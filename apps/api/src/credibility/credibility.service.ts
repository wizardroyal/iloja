import { Injectable, Logger } from '@nestjs/common';
import type { AgentBadgeTier, CredibilityEvent, CredibilityFactor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Weights from the product doc (§2.5):
 *
 *   Renter review ratings        — High
 *   Inspection show-up rate      — High
 *   Verified listings ratio      — High
 *   Response time                — Medium
 *   Completed rentals            — Medium
 *   Listing accuracy             — Medium
 *   Account history              — Low
 *
 * High = 1.0, Medium = 0.6, Low = 0.3. The score itself is the weighted
 * average of factor-level rolling means, mapped onto the doc's 0-5 scale.
 */
const FACTOR_WEIGHTS: Record<CredibilityFactor, number> = {
  review_rating: 1.0,
  inspection_show_up: 1.0,
  verified_listing_ratio: 1.0,
  response_time: 0.6,
  completed_rental: 0.6,
  listing_accuracy: 0.6,
  account_history: 0.3,
};

/** Doc thresholds (§2.5 Agent Badge Tiers). */
const TIER_BREAKPOINTS: { tier: AgentBadgeTier; minScore: number }[] = [
  { tier: 'diamond', minScore: 4.8 },
  { tier: 'gold', minScore: 4.5 },
  { tier: 'silver', minScore: 4.0 },
  { tier: 'blue', minScore: 0.01 },
  // Prisma maps the doc's "new" tier to `new_tier` since `new` is reserved.
  { tier: 'new_tier', minScore: 0 },
];

/** Render a tier as the user-facing label per the doc. */
export function tierLabel(tier: AgentBadgeTier): string {
  return tier === 'new_tier' ? 'New' : tier.charAt(0).toUpperCase() + tier.slice(1);
}

@Injectable()
export class CredibilityService {
  private readonly logger = new Logger(CredibilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only event log. The score itself is derived; a row added here can
   * never disappear — exactly the trust property the doc requires
   * ("agents and renters cannot be retroactively penalised").
   */
  async record(input: {
    subjectUserId: string;
    factor: CredibilityFactor;
    delta: number;
    reason: string;
    contextRef?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<CredibilityEvent> {
    const client = input.tx ?? this.prisma;
    return client.credibilityEvent.create({
      data: {
        subjectUserId: input.subjectUserId,
        factor: input.factor,
        delta: input.delta,
        reason: input.reason,
        contextRef: input.contextRef ?? null,
      },
    });
  }

  /**
   * Weighted-mean score in [0, 5] from this user's event history. Each factor
   * contributes its mean delta multiplied by its weight; we then re-scale by
   * the sum of weights of factors that have any data.
   */
  async computeScore(userId: string): Promise<{
    score: number;
    perFactor: Record<CredibilityFactor, { mean: number; sample: number }>;
  }> {
    const events = await this.prisma.credibilityEvent.findMany({
      where: { subjectUserId: userId },
    });

    const perFactor = {} as Record<CredibilityFactor, { sum: number; count: number }>;
    for (const ev of events) {
      const slot = perFactor[ev.factor] ?? { sum: 0, count: 0 };
      slot.sum += ev.delta;
      slot.count += 1;
      perFactor[ev.factor] = slot;
    }

    let weightedTotal = 0;
    let weightSum = 0;
    const summary = {} as Record<CredibilityFactor, { mean: number; sample: number }>;
    for (const [factor, weight] of Object.entries(FACTOR_WEIGHTS) as [
      CredibilityFactor,
      number,
    ][]) {
      const slot = perFactor[factor];
      if (!slot || slot.count === 0) {
        summary[factor] = { mean: 0, sample: 0 };
        continue;
      }
      const mean = slot.sum / slot.count;
      summary[factor] = { mean, sample: slot.count };
      weightedTotal += clamp(mean, 0, 5) * weight;
      weightSum += weight;
    }

    const score = weightSum === 0 ? 0 : weightedTotal / weightSum;
    return { score: round1(score), perFactor: summary };
  }

  /**
   * Score → tier mapping. Returns the highest tier whose threshold the score
   * has cleared. New users (no events) sit at `new`.
   */
  static tierForScore(score: number, completedRentals: number): AgentBadgeTier {
    if (completedRentals === 0 && score === 0) return 'new_tier';
    for (const { tier, minScore } of TIER_BREAKPOINTS) {
      if (score >= minScore) return tier;
    }
    return 'new_tier';
  }

  /**
   * Recompute and persist the agent's score + tier. Called after every event
   * write so the agent profile page always reflects the latest snapshot.
   * Idempotent — replaying the same event sequence yields the same row.
   */
  async refreshAgentSnapshot(userId: string): Promise<void> {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId } });
    if (!profile) {
      this.logger.debug(`No agent profile for ${userId} — skipping refresh`);
      return;
    }
    const { score } = await this.computeScore(userId);
    const tier = CredibilityService.tierForScore(score, profile.completedRentals);
    await this.prisma.agentProfile.update({
      where: { userId },
      data: { credibilityScore: score, badgeTier: tier },
    });
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
