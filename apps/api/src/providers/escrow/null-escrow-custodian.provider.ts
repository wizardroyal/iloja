import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  CustodianReceipt,
  EscrowCustodianProvider,
  OpenTrustInput,
  OpenTrustResult,
  ReleaseInput,
  RefundInput,
} from './escrow-custodian.provider';

/**
 * Sprint-4 stand-in. Returns deterministic refs and zero balances so the
 * full escrow lifecycle exercises end-to-end without an Anchor account.
 * Replace with AnchorEscrowCustodianProvider once KYB completes.
 */
@Injectable()
export class NullEscrowCustodianProvider implements EscrowCustodianProvider {
  private readonly logger = new Logger(NullEscrowCustodianProvider.name);

  async openTrustAccount(input: OpenTrustInput): Promise<OpenTrustResult> {
    const ref = `null-trust-${input.escrowId}`;
    this.logger.warn(`NullEscrowCustodian opening trust account ${ref}`);
    return {
      custodianRef: ref,
      fundingInstructions: {
        accountNumber: '0000000000',
        bankName: 'Iloja Test Bank',
        accountName: `Iloja Trust · ${input.escrowId}`,
      },
    };
  }

  async release(_input: ReleaseInput): Promise<CustodianReceipt> {
    return {
      providerRef: `null-rel-${randomBytes(6).toString('hex')}`,
      settledAt: new Date().toISOString(),
    };
  }

  async refund(_input: RefundInput): Promise<CustodianReceipt> {
    return {
      providerRef: `null-ref-${randomBytes(6).toString('hex')}`,
      settledAt: new Date().toISOString(),
    };
  }

  async getBalance(_custodianRef: string): Promise<bigint> {
    return BigInt(0);
  }
}
