/**
 * Escrow custodian — the licensed entity that legally holds funds while an
 * escrow is open. First implementation wraps Anchor. Per plan.md §3 we never
 * hold funds ourselves.
 *
 * The provider exposes three primitives: open a per-escrow trust account,
 * release to the payee, refund to the payer. State transitions are recorded
 * separately in our own ledger (EscrowEvent).
 */
export interface EscrowCustodianProvider {
  openTrustAccount(input: OpenTrustInput): Promise<OpenTrustResult>;
  release(input: ReleaseInput): Promise<CustodianReceipt>;
  refund(input: RefundInput): Promise<CustodianReceipt>;
  getBalance(custodianRef: string): Promise<bigint>;
}

export interface OpenTrustInput {
  /** Iloja-side escrow ID. Used as idempotency key. */
  escrowId: string;
  expectedAmountKobo: bigint;
}

export interface OpenTrustResult {
  custodianRef: string;
  fundingInstructions: {
    accountNumber: string;
    bankName: string;
    accountName: string;
  };
}

export interface ReleaseInput {
  custodianRef: string;
  amountKobo: bigint;
  recipient: { bankCode: string; accountNumber: string };
  reference: string;
}

export interface RefundInput {
  custodianRef: string;
  amountKobo: bigint;
  reference: string;
}

export interface CustodianReceipt {
  providerRef: string;
  settledAt: string;
}

export const ESCROW_CUSTODIAN_PROVIDER = Symbol('ESCROW_CUSTODIAN_PROVIDER');
