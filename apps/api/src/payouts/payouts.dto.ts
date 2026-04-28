import { z } from 'zod';

export const SetBankAccountSchema = z
  .object({
    bankCode: z.string().min(2).max(10),
    accountNumber: z.string().regex(/^[0-9]{6,20}$/),
    accountName: z.string().min(2).max(120),
  })
  .strict();
export type SetBankAccountDto = z.infer<typeof SetBankAccountSchema>;
