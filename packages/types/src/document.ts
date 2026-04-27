import { z } from 'zod';
import { IdSchema, IsoDateSchema } from './primitives';

/**
 * Documents that get hashed and anchored to Base L2. The full document lives in
 * Iloja's database; only its SHA-256 hash is on-chain.
 */
export const DocumentTypeSchema = z.enum([
  'tenancy_agreement',
  'inspection_report',
  'escrow_receipt',
  'dispute_outcome',
  'credibility_snapshot',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const AnchorStatusSchema = z.enum(['pending', 'submitted', 'confirmed', 'failed']);
export type AnchorStatus = z.infer<typeof AnchorStatusSchema>;

export const DocumentSchema = z.object({
  id: IdSchema,
  type: DocumentTypeSchema,
  /** Hex-encoded SHA-256 of the canonical document body. */
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  uri: z.string().url(),
  contextRef: z.string(),
  anchorStatus: AnchorStatusSchema,
  txHash: z.string().nullable(),
  blockNumber: z.number().int().nullable(),
  createdAt: IsoDateSchema,
  anchoredAt: IsoDateSchema.nullable(),
});
export type Document = z.infer<typeof DocumentSchema>;
