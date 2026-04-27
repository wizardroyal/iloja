import { z } from 'zod';

export const GenerateAgreementSchema = z
  .object({
    listingId: z.string().min(20),
    renterId: z.string().min(20),
    /** Annual rent agreed for this tenancy, in kobo. */
    rentKobo: z.coerce.bigint().positive(),
    /** Tenancy start date, ISO 8601. */
    startDate: z.string().datetime(),
    /** Tenancy duration in months. */
    termMonths: z.number().int().min(1).max(120),
    /** Optional caution money / deposit. */
    cautionKobo: z.coerce.bigint().nonnegative().optional(),
    /** Free-form clauses both parties agreed to in chat. */
    additionalTerms: z.string().max(5000).optional(),
  })
  .strict();
export type GenerateAgreementDto = z.infer<typeof GenerateAgreementSchema>;
