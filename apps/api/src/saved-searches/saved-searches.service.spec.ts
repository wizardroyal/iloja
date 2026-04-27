import type { Listing, SavedSearch } from '@prisma/client';
import { SavedSearchesService } from './saved-searches.service';

/**
 * The interesting behaviour of saved-search alerts is the watermark:
 * a listing that just verified should fire once, never again. We test
 * the filter shape and the watermark advance directly via fakes.
 */

function makeFakePrisma(opts: {
  searches: SavedSearch[];
  listings: Listing[];
}) {
  return {
    savedSearch: {
      findMany: async () => opts.searches,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { lastAlertedAt: Date };
      }) => {
        const s = opts.searches.find((x) => x.id === where.id);
        if (s) s.lastAlertedAt = data.lastAlertedAt;
        return s as SavedSearch;
      },
    },
    listing: {
      findMany: async ({
        where,
      }: {
        where: {
          status: string;
          verifiedAt?: { gt: Date };
          neighborhood?: string;
          bedrooms?: number;
          type?: string;
          priceKobo?: { gte?: bigint; lte?: bigint };
        };
      }) =>
        opts.listings
          .filter((l) => l.status === where.status)
          .filter((l) =>
            where.verifiedAt?.gt ? l.verifiedAt && l.verifiedAt > where.verifiedAt.gt : true,
          )
          .filter((l) => (where.neighborhood ? l.neighborhood === where.neighborhood : true))
          .filter((l) => (where.bedrooms !== undefined ? l.bedrooms === where.bedrooms : true))
          .filter((l) => (where.type ? l.type === where.type : true))
          .filter((l) => {
            if (!where.priceKobo) return true;
            if (where.priceKobo.gte !== undefined && l.priceKobo < where.priceKobo.gte) return false;
            if (where.priceKobo.lte !== undefined && l.priceKobo > where.priceKobo.lte) return false;
            return true;
          })
          .sort(
            (a, b) =>
              (a.verifiedAt?.getTime() ?? 0) - (b.verifiedAt?.getTime() ?? 0),
          ),
    },
  };
}

const notifications = { notify: jest.fn(async () => ({})) };

function makeListing(overrides: Partial<Listing>): Listing {
  return {
    id: overrides.id ?? 'l1',
    ownerId: 'agent1',
    type: 'long_term',
    status: 'active',
    title: 'A flat',
    description: 'desc',
    bedrooms: 2,
    bathrooms: 2,
    priceKobo: BigInt(85_000_000),
    pricePeriod: 'year',
    neighborhood: 'Yaba',
    address: '12 Yaba Rd',
    lat: 6.5,
    lng: 3.3,
    amenities: [],
    verifiedAt: new Date('2026-04-01T00:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSearch(overrides: Partial<SavedSearch>): SavedSearch {
  return {
    id: 's1',
    userId: 'u1',
    label: null,
    type: null,
    neighborhood: null,
    bedrooms: null,
    minPriceKobo: null,
    maxPriceKobo: null,
    lastAlertedAt: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

describe('SavedSearchesService.runAlerts', () => {
  beforeEach(() => notifications.notify.mockClear());

  it('notifies on a fresh match and advances the watermark', async () => {
    const search = makeSearch({ neighborhood: 'Yaba', bedrooms: 2 });
    const listing = makeListing({ verifiedAt: new Date('2026-04-15T00:00:00Z') });
    const prisma = makeFakePrisma({ searches: [search], listings: [listing] });
    const svc = new SavedSearchesService(prisma as never, notifications as never);

    const result = await svc.runAlerts();
    expect(result.alerts).toBe(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(search.lastAlertedAt).toEqual(listing.verifiedAt);
  });

  it('does not double-fire after the watermark has advanced', async () => {
    const watermark = new Date('2026-04-15T00:00:00Z');
    const search = makeSearch({
      neighborhood: 'Yaba',
      lastAlertedAt: watermark,
    });
    const listing = makeListing({ verifiedAt: watermark });
    const prisma = makeFakePrisma({ searches: [search], listings: [listing] });
    const svc = new SavedSearchesService(prisma as never, notifications as never);

    await svc.runAlerts();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('respects price filters', async () => {
    const search = makeSearch({
      neighborhood: 'Yaba',
      maxPriceKobo: BigInt(80_000_000),
    });
    const tooExpensive = makeListing({ priceKobo: BigInt(120_000_000) });
    const ok = makeListing({ id: 'l2', priceKobo: BigInt(70_000_000) });
    const prisma = makeFakePrisma({
      searches: [search],
      listings: [tooExpensive, ok],
    });
    const svc = new SavedSearchesService(prisma as never, notifications as never);

    const result = await svc.runAlerts();
    expect(result.alerts).toBe(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });
});
