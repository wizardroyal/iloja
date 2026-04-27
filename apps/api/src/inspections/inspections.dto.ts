import { z } from 'zod';

export const ProposeInspectionSchema = z
  .object({
    threadId: z.string().min(20),
    /** ISO 8601 datetime, must be in the future. */
    scheduledAt: z
      .string()
      .datetime()
      .refine((s) => new Date(s).getTime() > Date.now(), { message: 'must be in the future' }),
  })
  .strict();
export type ProposeInspectionDto = z.infer<typeof ProposeInspectionSchema>;
