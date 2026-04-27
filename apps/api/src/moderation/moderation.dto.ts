import { z } from 'zod';

export const RestrictUserSchema = z
  .object({
    userId: z.string().min(20),
    kind: z.enum(['warning', 'inspection_cooldown', 'account_suspended', 'permanent_ban']),
    reason: z.string().min(10).max(2000),
    /** Optional ISO 8601 expiry. Permanent bans omit this. */
    expiresAt: z.string().datetime().optional(),
  })
  .strict();
export type RestrictUserDto = z.infer<typeof RestrictUserSchema>;
