import { z } from 'zod';
import { GeoPointSchema, IdSchema, IsoDateSchema } from './primitives';

export const VerificationJobStatusSchema = z.enum([
  'unclaimed',
  'claimed',
  'submitted',
  'approved',
  'rejected',
]);
export type VerificationJobStatus = z.infer<typeof VerificationJobStatusSchema>;

/** Operator-captured artefact: photo, video, or floor plan, with embedded GPS. */
export const VerificationArtefactSchema = z.object({
  id: IdSchema,
  kind: z.enum(['photo', 'video', 'floorplan']),
  url: z.string().url(),
  capturedAt: IsoDateSchema,
  location: GeoPointSchema.nullable(),
});
export type VerificationArtefact = z.infer<typeof VerificationArtefactSchema>;

export const VerificationJobSchema = z.object({
  id: IdSchema,
  listingId: IdSchema,
  status: VerificationJobStatusSchema,
  operatorId: IdSchema.nullable(),
  artefacts: z.array(VerificationArtefactSchema),
  /** Distance in metres between operator GPS and listing geocoded address. */
  gpsMismatchMetres: z.number().nullable(),
  decisionReason: z.string().nullable(),
  createdAt: IsoDateSchema,
  decidedAt: IsoDateSchema.nullable(),
});
export type VerificationJob = z.infer<typeof VerificationJobSchema>;
