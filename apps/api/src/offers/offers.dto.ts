import { z } from 'zod';

export const MakeOfferSchema = z
  .object({
    amountKobo: z.coerce.bigint().positive(),
    termsSummary: z.string().max(500).optional(),
  })
  .strict();
export type MakeOfferDto = z.infer<typeof MakeOfferSchema>;

export const SimpleNoteSchema = z
  .object({
    note: z.string().max(500).optional(),
  })
  .strict();
export type SimpleNoteDto = z.infer<typeof SimpleNoteSchema>;
