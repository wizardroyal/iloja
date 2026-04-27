/**
 * Collection rail. First implementation wraps Paystack. The provider only
 * collects funds and pays them out — escrow custody is a separate concern
 * (see EscrowCustodianProvider).
 */
export interface PaymentsProvider {
  initiateCollection(input: CollectionRequest): Promise<CollectionInitResult>;
  verifyCollection(reference: string): Promise<CollectionStatus>;
  payout(input: PayoutRequest): Promise<PayoutResult>;
  /** Verify a webhook payload signature against the shared secret. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}

export interface CollectionRequest {
  amountKobo: bigint;
  reference: string;
  customer: { email?: string; phone: string };
  metadata?: Record<string, string>;
}

export interface CollectionInitResult {
  reference: string;
  authorizationUrl: string;
}

export type CollectionStatus =
  | { status: 'pending' }
  | { status: 'success'; paidAt: string }
  | { status: 'failed'; reason: string };

export interface PayoutRequest {
  amountKobo: bigint;
  reference: string;
  recipient: { bankCode: string; accountNumber: string; accountName: string };
}

export interface PayoutResult {
  reference: string;
  providerRef: string;
  status: 'queued' | 'success' | 'failed';
}

export const PAYMENTS_PROVIDER = Symbol('PAYMENTS_PROVIDER');
