import { z } from 'zod';

export const OpenThreadSchema = z
  .object({
    listingId: z.string().min(20),
  })
  .strict();
export type OpenThreadDto = z.infer<typeof OpenThreadSchema>;

export const SendMessageSchema = z
  .object({
    body: z.string().min(1).max(2000),
  })
  .strict();
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
