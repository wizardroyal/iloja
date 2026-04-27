import { z } from 'zod';
import { GeoPointSchema, IdSchema, IsoDateSchema, KoboSchema } from './primitives';

export const ListingTypeSchema = z.enum(['short_let', 'long_term', 'commercial']);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const ListingStatusSchema = z.enum([
  'draft',
  'pending_verification',
  'active',
  'paused',
  'archived',
  'rejected',
]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ListingPhotoSchema = z.object({
  id: IdSchema,
  url: z.string().url(),
  position: z.number().int().nonnegative(),
});
export type ListingPhoto = z.infer<typeof ListingPhotoSchema>;

export const ListingSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  type: ListingTypeSchema,
  status: ListingStatusSchema,
  title: z.string().min(8).max(140),
  description: z.string().min(20),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  price: KoboSchema, // per /night for short-let, /year for long-term
  pricePeriod: z.enum(['night', 'week', 'month', 'year']),
  neighborhood: z.string(),
  address: z.string(),
  location: GeoPointSchema,
  amenities: z.array(z.string()),
  photos: z.array(ListingPhotoSchema),
  verifiedAt: IsoDateSchema.nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type Listing = z.infer<typeof ListingSchema>;

/** Subset of a Listing visible in feeds (home, search). Cheap to serialize. */
export const ListingSummarySchema = ListingSchema.pick({
  id: true,
  type: true,
  title: true,
  bedrooms: true,
  price: true,
  pricePeriod: true,
  neighborhood: true,
  verifiedAt: true,
}).extend({
  thumbnailUrl: z.string().url().nullable(),
  agent: z
    .object({
      id: IdSchema,
      initial: z.string().length(1),
      score: z.number().min(0).max(5),
      badgeTier: z.enum(['new', 'blue', 'silver', 'gold', 'diamond']),
    })
    .nullable(),
});
export type ListingSummary = z.infer<typeof ListingSummarySchema>;

/** Payload for creating/editing a listing draft. */
export const ListingDraftInputSchema = ListingSchema.pick({
  type: true,
  title: true,
  description: true,
  bedrooms: true,
  bathrooms: true,
  price: true,
  pricePeriod: true,
  neighborhood: true,
  address: true,
  location: true,
  amenities: true,
}).partial();
export type ListingDraftInput = z.infer<typeof ListingDraftInputSchema>;
