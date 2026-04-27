/**
 * On-chain anchoring of document hashes. First implementation wraps Base L2
 * via ethers.js + a small DocumentRegistry contract (see packages/contracts).
 * The interface stays minimal — a single `anchor` call per batched document —
 * so we can swap chains (e.g. Optimism, Arbitrum) without touching consumers.
 *
 * Per the doc, only SHA-256 hashes leave the platform. No PII, no document
 * bodies, no user addresses — the anchor wallet is shared across all
 * inscriptions.
 */
export interface ChainAnchorProvider {
  /**
   * Submits one (hash, type, uri) tuple to the registry. Returns once the
   * transaction is mined enough to be considered durable for our purposes
   * (~1 block confirmation on Base L2).
   */
  anchor(input: AnchorInput): Promise<AnchorReceipt>;
}

export interface AnchorInput {
  /** SHA-256 hex with the 0x prefix. */
  hash: string;
  /** Document type as a short identifier. */
  docType: string;
  /** Off-chain pointer (`iloja://documents/...`). */
  uri: string;
}

export interface AnchorReceipt {
  txHash: string;
  blockNumber: number;
}

export const CHAIN_ANCHOR_PROVIDER = Symbol('CHAIN_ANCHOR_PROVIDER');
