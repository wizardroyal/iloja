import { z } from 'zod';
import { IdSchema, IsoDateSchema } from './primitives';

/** Per the doc — weights translate into score impact at compute time. */
export const CredibilityFactorSchema = z.enum([
  'review_rating',
  'inspection_show_up',
  'verified_listing_ratio',
  'response_time',
  'completed_rental',
  'listing_accuracy',
  'account_history',
]);
export type CredibilityFactor = z.infer<typeof CredibilityFactorSchema>;

/** Append-only event. Score is a derived value from these. */
export const CredibilityEventSchema = z.object({
  id: IdSchema,
  subjectUserId: IdSchema,
  factor: CredibilityFactorSchema,
  /** Positive or negative delta. Magnitude gets weighted at score time. */
  delta: z.number(),
  reason: z.string(),
  contextRef: z.string().nullable(),
  createdAt: IsoDateSchema,
});
export type CredibilityEvent = z.infer<typeof CredibilityEventSchema>;
