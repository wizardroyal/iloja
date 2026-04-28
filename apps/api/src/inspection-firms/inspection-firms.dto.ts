import { z } from 'zod';

export const CreateFirmSchema = z
  .object({
    name: z.string().min(2).max(120),
    zones: z.array(z.string().min(2)).min(1).max(50),
    rateKobo: z.coerce.bigint().positive(),
    coordinationBps: z.number().int().min(0).max(2000).optional(),
    contactPhone: z.string().min(8).optional(),
    contactEmail: z.string().email().optional(),
  })
  .strict();
export type CreateFirmDto = z.infer<typeof CreateFirmSchema>;

export const BookFirmSchema = z
  .object({
    firmId: z.string().min(20),
    listingId: z.string().min(20),
    scheduledAt: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type BookFirmDto = z.infer<typeof BookFirmSchema>;
