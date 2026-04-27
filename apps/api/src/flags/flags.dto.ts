import { z } from 'zod';

export const CreateFlagSchema = z
  .object({
    listingId: z.string().min(20),
    reason: z.string().min(10).max(2000),
    evidenceUrls: z.array(z.string().url()).max(20).optional(),
  })
  .strict();
export type CreateFlagDto = z.infer<typeof CreateFlagSchema>;

export const ResolveFlagSchema = z
  .object({
    valid: z.boolean(),
    decisionNotes: z.string().min(5).max(2000),
  })
  .strict();
export type ResolveFlagDto = z.infer<typeof ResolveFlagSchema>;
