import { z } from 'zod';

const ListingTypeSchema = z.enum(['short_let', 'long_term', 'commercial']);

export const CreateSavedSearchSchema = z
  .object({
    label: z.string().min(1).max(80).optional(),
    type: ListingTypeSchema.optional(),
    neighborhood: z.string().min(2).optional(),
    bedrooms: z.number().int().min(0).max(20).optional(),
    minPriceKobo: z.coerce.bigint().nonnegative().optional(),
    maxPriceKobo: z.coerce.bigint().nonnegative().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.type !== undefined ||
      v.neighborhood !== undefined ||
      v.bedrooms !== undefined ||
      v.minPriceKobo !== undefined ||
      v.maxPriceKobo !== undefined,
    { message: 'at least one filter is required' },
  );
export type CreateSavedSearchDto = z.infer<typeof CreateSavedSearchSchema>;
