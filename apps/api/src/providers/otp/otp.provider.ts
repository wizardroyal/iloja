/**
 * One-time-password channel. First implementation wraps Termii (SMS + voice
 * fallback for Nigerian phones). Interface stays small so we can switch to
 * Africa's Talking or Twilio later.
 */
export interface OtpProvider {
  /**
   * Generate and send a code. Returns a token the verify call uses to look
   * up the original send. The plaintext code is never returned to the caller.
   */
  send(input: SendOtpInput): Promise<SendOtpResult>;
}

export interface SendOtpInput {
  phone: string;
  /** Channel hint; provider may fall back. */
  channel?: 'sms' | 'voice' | 'whatsapp';
  ttlSeconds?: number;
}

export interface SendOtpResult {
  pinId: string;
  expiresAt: string;
}

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');
