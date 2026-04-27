import { z } from 'zod';

const ArtefactSchema = z.object({
  kind: z.enum(['photo', 'video', 'floorplan']),
  url: z.string().url(),
  capturedAt: z.string().datetime(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

/**
 * Operator submits the captured walkthrough. The dominant lat/lng (server
 * picks the median across artefacts) is what we cross-check against the
 * geocoded listing address.
 */
export const SubmitVerificationSchema = z
  .object({
    artefacts: z.array(ArtefactSchema).min(3),
  })
  .strict();

export type SubmitVerificationDto = z.infer<typeof SubmitVerificationSchema>;

export const RejectVerificationSchema = z
  .object({
    reason: z.string().min(5).max(500),
  })
  .strict();

export type RejectVerificationDto = z.infer<typeof RejectVerificationSchema>;
