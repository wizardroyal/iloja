/**
 * Vendor-agnostic KYC interface. The first implementation will wrap Dojah; the
 * interface exists so we can drop in Smile Identity or Mono later without
 * touching the consumers.
 *
 * Inputs are masked PII strings. Implementations are expected to never log the
 * raw values, never persist them outside encrypted storage, and never echo
 * them back in responses.
 */
export interface KycProvider {
  verifyNin(nin: string, fullName: string): Promise<KycResult>;
  verifyBvn(bvn: string, fullName: string, dob?: string): Promise<KycResult>;
  verifyCac(rcNumber: string): Promise<KycResult>;
}

export interface KycResult {
  status: 'verified' | 'rejected' | 'pending';
  reference: string;
  reason?: string;
}

export const KYC_PROVIDER = Symbol('KYC_PROVIDER');
