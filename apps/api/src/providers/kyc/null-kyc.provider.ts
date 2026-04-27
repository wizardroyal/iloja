import { Injectable, Logger } from '@nestjs/common';
import type { KycProvider, KycResult } from './kyc.provider';

/**
 * Sprint-0 stand-in. Always returns 'pending' so flows wire through end-to-end
 * without making real Dojah calls. Replace with DojahKycProvider in Sprint 1.
 */
@Injectable()
export class NullKycProvider implements KycProvider {
  private readonly logger = new Logger(NullKycProvider.name);

  async verifyNin(_nin: string, _fullName: string): Promise<KycResult> {
    this.logger.warn('NullKycProvider used — no real verification performed');
    return { status: 'pending', reference: `null-${Date.now()}` };
  }

  async verifyBvn(_bvn: string, _fullName: string, _dob?: string): Promise<KycResult> {
    return { status: 'pending', reference: `null-${Date.now()}` };
  }

  async verifyCac(_rcNumber: string): Promise<KycResult> {
    return { status: 'pending', reference: `null-${Date.now()}` };
  }
}
