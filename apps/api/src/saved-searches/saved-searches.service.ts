import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Listing, Prisma, SavedSearch } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSavedSearchDto } from './saved-searches.dto';

/**
 * Renter-side saved searches. The `runAlerts` method is what the worker
 * calls hourly: it finds active listings whose `verifiedAt` is past each
 * search's `lastAlertedAt`, fans them out to the inbox, and advances the
 * watermark. Idempotent — a re-run with no new listings is a no-op.
 */
@Injectable()
export class SavedSearchesService {
  private readonly logger = new Logger(SavedSearchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, input: CreateSavedSearchDto): Promise<SavedSearch> {
    return this.prisma.savedSearch.create({
      data: {
        userId,
        label: input.label ?? null,
        type: input.type ?? null,
        neighborhood: input.neighborhood ?? null,
        bedrooms: input.bedrooms ?? null,
        minPriceKobo: input.minPriceKobo ?? null,
        maxPriceKobo: input.maxPriceKobo ?? null,
      },
    });
  }

  async listForUser(userId: string): Promise<SavedSearch[]> {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, userId: string): Promise<{ ok: true }> {
    const search = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!search) throw new NotFoundException(`Saved search ${id} not found`);
    if (search.userId !== userId) throw new ForbiddenException('not yours');
    await this.prisma.savedSearch.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Worker entrypoint. Returns counts so the caller can log/observe; never
   * throws on a per-search miss — the runner stays healthy even if one
   * search has a bad filter.
   */
  async runAlerts(): Promise<{ alerts: number; searches: number }> {
    const searches = await this.prisma.savedSearch.findMany({});
    let total = 0;
    for (const search of searches) {
      try {
        total += await this.alertOne(search);
      } catch (err) {
        this.logger.warn(`saved search ${search.id} alert run failed: ${(err as Error).message}`);
      }
    }
    return { alerts: total, searches: searches.length };
  }

  private async alertOne(search: SavedSearch): Promise<number> {
    const where: Prisma.ListingWhereInput = {
      status: 'active',
      verifiedAt: { gt: search.lastAlertedAt ?? search.createdAt },
      ...(search.type ? { type: search.type } : {}),
      ...(search.neighborhood ? { neighborhood: search.neighborhood } : {}),
      ...(search.bedrooms !== null ? { bedrooms: search.bedrooms } : {}),
      ...(search.minPriceKobo !== null || search.maxPriceKobo !== null
        ? {
            priceKobo: {
              ...(search.minPriceKobo !== null ? { gte: search.minPriceKobo } : {}),
              ...(search.maxPriceKobo !== null ? { lte: search.maxPriceKobo } : {}),
            },
          }
        : {}),
    };
    const matches = await this.prisma.listing.findMany({
      where,
      orderBy: { verifiedAt: 'asc' },
      take: 20,
    });
    if (matches.length === 0) return 0;

    for (const listing of matches) {
      await this.notifications.notify({
        userId: search.userId,
        kind: 'listing_verified',
        title: search.label ? `New match: ${search.label}` : 'New listing matches your search',
        body: `${listing.title} · ${listing.neighborhood}`,
        href: `/listings/${listing.id}`,
        contextRef: listing.id,
      });
    }
    const last = matches[matches.length - 1] as Listing;
    await this.prisma.savedSearch.update({
      where: { id: search.id },
      data: { lastAlertedAt: last.verifiedAt ?? new Date() },
    });
    return matches.length;
  }
}
