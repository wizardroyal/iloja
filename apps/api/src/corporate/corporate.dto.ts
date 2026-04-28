import { z } from 'zod';

export const CreateCorporateAccountSchema = z
  .object({
    name: z.string().min(2).max(160),
    notes: z.string().max(2000).optional(),
    placementFeeKobo: z.coerce.bigint().positive(),
    contactPhone: z.string().min(8).optional(),
    contactEmail: z.string().email().optional(),
  })
  .strict();
export type CreateCorporateAccountDto = z.infer<typeof CreateCorporateAccountSchema>;

export const CreatePlacementRequestSchema = z
  .object({
    corporateAccountId: z.string().min(20),
    hrContactName: z.string().min(2).max(120),
    budgetMinKobo: z.coerce.bigint().nonnegative().optional(),
    budgetMaxKobo: z.coerce.bigint().nonnegative().optional(),
    bedrooms: z.number().int().min(0).max(20).optional(),
    preferredZones: z.array(z.string().min(2)).max(50).optional(),
    needBy: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type CreatePlacementRequestDto = z.infer<typeof CreatePlacementRequestSchema>;

export const MatchPlacementSchema = z
  .object({
    matchedListingId: z.string().min(20),
    placedRenterId: z.string().min(20).optional(),
  })
  .strict();
export type MatchPlacementDto = z.infer<typeof MatchPlacementSchema>;
