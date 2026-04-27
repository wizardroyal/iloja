import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { OtpProvider, SendOtpInput, SendOtpResult } from './otp.provider';

/**
 * Sprint-1 stand-in. The OTP itself is generated and stored by the auth
 * module — this provider only "sends" it (i.e. logs it during dev). Real
 * Termii integration replaces this in the next pass.
 */
@Injectable()
export class NullOtpProvider implements OtpProvider {
  private readonly logger = new Logger(NullOtpProvider.name);

  async send(input: SendOtpInput): Promise<SendOtpResult> {
    const pinId = randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? 300) * 1000).toISOString();
    this.logger.warn(
      `NullOtpProvider used — no SMS sent to ${input.phone}. pinId=${pinId} expiresAt=${expiresAt}`,
    );
    return { pinId, expiresAt };
  }
}
