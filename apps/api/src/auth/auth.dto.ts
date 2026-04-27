import { z } from 'zod';

/**
 * Loosely permissive — international format, but Lagos is the launch market
 * so we don't dial-code-restrict. Real format checks happen in the OTP
 * provider on send.
 */
const phone = z.string().min(8).max(20).regex(/^\+?[0-9]+$/);

export const RequestOtpSchema = z.object({ phone }).strict();
export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;

export const VerifyOtpSchema = z
  .object({
    phone,
    code: z.string().regex(/^[0-9]{6}$/),
    /** New users provide a name on first verify so we can mint a User row. */
    fullName: z.string().min(1).max(100).optional(),
  })
  .strict();
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
