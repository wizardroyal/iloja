import { z } from 'zod';
import { IdSchema, IsoDateSchema, KoboSchema } from './primitives';

export const EscrowKindSchema = z.enum(['inspection_fee', 'short_let_booking', 'long_term_rent']);
export type EscrowKind = z.infer<typeof EscrowKindSchema>;

/**
 * State machine. Every transition is event-sourced; the admin tools can
 * reconstruct any escrow's full history.
 *
 *   created -> funded -> released | refunded | disputed -> released | refunded
 */
export const EscrowStateSchema = z.enum([
  'created',
  'funded',
  'released',
  'refunded',
  'disputed',
  'expired',
]);
export type EscrowState = z.infer<typeof EscrowStateSchema>;

export const EscrowSchema = z.object({
  id: IdSchema,
  kind: EscrowKindSchema,
  state: EscrowStateSchema,
  payerId: IdSchema,
  payeeId: IdSchema,
  listingId: IdSchema.nullable(),
  amount: KoboSchema,
  feeAmount: KoboSchema,
  /** Custodian's identifier (Anchor account/transfer ref). Null until funded. */
  custodianRef: z.string().nullable(),
  /** When the escrow auto-releases without explicit confirmation. */
  autoReleaseAt: IsoDateSchema.nullable(),
  createdAt: IsoDateSchema,
  fundedAt: IsoDateSchema.nullable(),
  resolvedAt: IsoDateSchema.nullable(),
});
export type Escrow = z.infer<typeof EscrowSchema>;

export const DisputeStatusSchema = z.enum(['open', 'evidence', 'resolved_payer', 'resolved_payee']);
export type DisputeStatus = z.infer<typeof DisputeStatusSchema>;

export const DisputeSchema = z.object({
  id: IdSchema,
  escrowId: IdSchema,
  openedByUserId: IdSchema,
  status: DisputeStatusSchema,
  reason: z.string().min(10),
  evidenceUrls: z.array(z.string().url()),
  decisionNotes: z.string().nullable(),
  createdAt: IsoDateSchema,
  resolvedAt: IsoDateSchema.nullable(),
});
export type Dispute = z.infer<typeof DisputeSchema>;
