import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { AnchorInput, AnchorReceipt, ChainAnchorProvider } from './chain-anchor.provider';

/**
 * Sprint-5 stand-in. Pretends to write to Base L2 but only logs and
 * returns a deterministic stub txHash/blockNumber so the anchor pipeline
 * exercises end-to-end without an RPC URL or relayer wallet.
 */
@Injectable()
export class NullChainAnchorProvider implements ChainAnchorProvider {
  private readonly logger = new Logger(NullChainAnchorProvider.name);
  private blockCounter = 1;

  async anchor(input: AnchorInput): Promise<AnchorReceipt> {
    this.logger.warn(
      `NullChainAnchor pretending to write ${input.hash.slice(0, 18)}… (${input.docType})`,
    );
    return {
      txHash: '0x' + randomBytes(32).toString('hex'),
      blockNumber: 1_000_000 + this.blockCounter++,
    };
  }
}
