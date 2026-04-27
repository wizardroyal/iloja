import { z } from 'zod';

export const PresignListingPhotoSchema = z
  .object({
    listingId: z.string().min(20),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  })
  .strict();
export type PresignListingPhotoDto = z.infer<typeof PresignListingPhotoSchema>;
