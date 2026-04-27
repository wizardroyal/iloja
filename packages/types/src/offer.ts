import { z } from 'zod';
import { IdSchema, IsoDateSchema, KoboSchema } from './primitives';

export const OfferEventTypeSchema = z.enum([
  'offer_made',
  'counter_offer',
  'accepted',
  'declined',
  'withdrawn',
]);
export type OfferEventType = z.infer<typeof OfferEventTypeSchema>;

/**
 * Offer events are append-only. The audit trail is the product, not just the
 * implementation — the doc explicitly calls this out as a renter and agent
 * protection.
 */
export const OfferEventSchema = z.object({
  id: IdSchema,
  threadId: IdSchema,
  byUserId: IdSchema,
  type: OfferEventTypeSchema,
  amount: KoboSchema.nullable(),
  termsSummary: z.string().nullable(),
  createdAt: IsoDateSchema,
});
export type OfferEvent = z.infer<typeof OfferEventSchema>;
