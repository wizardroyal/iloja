import type { ListingResponse } from '@iloja/sdk';

/**
 * Mock listings used until the API has real data. Swap by simply seeding the
 * database — the home page reads from /listings first and falls back here.
 */
export const sampleShortLets: Pick<
  ListingResponse,
  'id' | 'title' | 'priceKobo' | 'pricePeriod' | 'neighborhood' | 'bedrooms' | 'verifiedAt'
>[] = [
  {
    id: 'sample-1',
    title: 'Studio serviced apartment, fully furnished',
    priceKobo: '5500000',
    pricePeriod: 'night',
    neighborhood: 'Lekki Phase 1',
    bedrooms: 1,
    verifiedAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    title: 'Modern 2-bed short-let, pool access',
    priceKobo: '3800000',
    pricePeriod: 'night',
    neighborhood: 'Ikeja GRA',
    bedrooms: 2,
    verifiedAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    title: 'Luxury penthouse, panoramic views',
    priceKobo: '7500000',
    pricePeriod: 'night',
    neighborhood: 'Victoria Island',
    bedrooms: 3,
    verifiedAt: new Date().toISOString(),
  },
];

export const sampleLongTerms: Pick<
  ListingResponse,
  'id' | 'title' | 'priceKobo' | 'pricePeriod' | 'neighborhood' | 'bedrooms' | 'verifiedAt'
>[] = [
  {
    id: 'sample-lt-1',
    title: '2-bedroom apartment · self-contained',
    priceKobo: '85000000',
    pricePeriod: 'year',
    neighborhood: 'Yaba',
    bedrooms: 2,
    verifiedAt: new Date().toISOString(),
  },
  {
    id: 'sample-lt-2',
    title: '3-bedroom flat, en-suite master',
    priceKobo: '120000000',
    pricePeriod: 'year',
    neighborhood: 'Surulere',
    bedrooms: 3,
    verifiedAt: new Date().toISOString(),
  },
  {
    id: 'sample-lt-3',
    title: '1-bedroom self-con, generator included',
    priceKobo: '60000000',
    pricePeriod: 'year',
    neighborhood: 'Ikeja',
    bedrooms: 1,
    verifiedAt: new Date().toISOString(),
  },
];

/** Format a kobo string as ₦-prefixed Naira display (e.g. "₦55,000"). */
export function formatNairaFromKobo(koboStr: string | bigint): string {
  const kobo = typeof koboStr === 'string' ? BigInt(koboStr) : koboStr;
  const naira = Number(kobo / BigInt(100));
  return `₦${naira.toLocaleString('en-NG')}`;
}
