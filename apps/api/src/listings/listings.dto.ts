import { z } from 'zod';

const ListingTypeSchema = z.enum(['short_let', 'long_term', 'commercial']);
const PricePeriodSchema = z.enum(['night', 'week', 'month', 'year']);

/**
 * Draft creation accepts a partial payload — agents move through screen 07 in
 * 4 steps, saving as they go. Full validation happens on submit.
 */
export const CreateListingDraftSchema = z
  .object({
    type: ListingTypeSchema,
    title: z.string().min(8).max(140).optional(),
    description: z.string().min(20).optional(),
    bedrooms: z.number().int().min(0).max(20).optional(),
    bathrooms: z.number().int().min(0).max(20).optional(),
    priceKobo: z.coerce.bigint().nonnegative().optional(),
    pricePeriod: PricePeriodSchema.optional(),
    neighborhood: z.string().min(2).optional(),
    address: z.string().min(5).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    amenities: z.array(z.string()).optional(),
  })
  .strict();

export type CreateListingDraftDto = z.infer<typeof CreateListingDraftSchema>;

export const UpdateListingDraftSchema = CreateListingDraftSchema.partial().strict();
export type UpdateListingDraftDto = z.infer<typeof UpdateListingDraftSchema>;

/**
 * Required fields before a draft can be submitted for verification. Enforced
 * server-side rather than relying on the client's step-tracker — the agent app
 * is not the source of truth.
 */
export const ListingSubmissionRequiredSchema = z.object({
  title: z.string().min(8).max(140),
  description: z.string().min(20),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  priceKobo: z.bigint().positive(),
  pricePeriod: PricePeriodSchema,
  neighborhood: z.string().min(2),
  address: z.string().min(5),
  lat: z.number().refine((v) => v !== 0, { message: 'latitude required' }),
  lng: z.number().refine((v) => v !== 0, { message: 'longitude required' }),
});

export const AddListingPhotoSchema = z
  .object({
    url: z.string().url(),
    position: z.number().int().nonnegative().max(50),
  })
  .strict();
export type AddListingPhotoDto = z.infer<typeof AddListingPhotoSchema>;

export const UpdateListingScheduleSchema = z
  .object({
    publishStartAt: z.string().datetime().nullable().optional(),
    publishEndAt: z.string().datetime().nullable().optional(),
  })
  .strict();
export type UpdateListingScheduleDto = z.infer<typeof UpdateListingScheduleSchema>;
