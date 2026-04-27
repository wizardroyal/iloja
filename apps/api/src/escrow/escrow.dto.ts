import { z } from 'zod';

export const CreateInspectionEscrowSchema = z
  .object({
    inspectionId: z.string().min(20),
  })
  .strict();
export type CreateInspectionEscrowDto = z.infer<typeof CreateInspectionEscrowSchema>;

export const CheckInSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();
export type CheckInDto = z.infer<typeof CheckInSchema>;

export const OpenDisputeSchema = z
  .object({
    reason: z.string().min(10).max(2000),
    evidenceUrls: z.array(z.string().url()).max(20).optional(),
  })
  .strict();
export type OpenDisputeDto = z.infer<typeof OpenDisputeSchema>;

export const DisputeDecisionSchema = z
  .object({
    inFavorOf: z.enum(['payer', 'payee']),
    decisionNotes: z.string().min(10).max(2000),
  })
  .strict();
export type DisputeDecisionDto = z.infer<typeof DisputeDecisionSchema>;
