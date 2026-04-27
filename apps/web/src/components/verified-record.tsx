'use client';

import type { DocumentResponse } from '@iloja/sdk';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';

/**
 * The doc-mandated UX (§2.10 user-facing experience):
 *   "Every document generated on Iloja carries a 'Verified Record' indicator.
 *    Tapping it shows: document type, timestamp, and verification status.
 *    No blockchain terminology. No wallet addresses."
 *
 * The component shows the badge inline; tapping pops a modal with the
 * Iloja-side metadata. The on-chain link is one extra tap behind a Verify
 * link for users who want to independently confirm.
 */
export function VerifiedRecord({
  contextRef,
  label = 'Verified Record',
  compact,
}: {
  contextRef: string;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function show(): Promise<void> {
    setOpen(true);
    if (doc) return;
    setLoading(true);
    setError(null);
    try {
      const matches = await getBrowserClient().listDocumentsByContext(contextRef);
      setDoc(matches[0] ?? null);
    } catch {
      setError('Could not load Verified Record');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={show}
        className={
          compact
            ? 'inline-flex items-center gap-1 text-[10px] font-semibold text-grove bg-success-tint border border-mint rounded px-1.5 py-0.5'
            : 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-grove bg-success-tint border border-mint rounded-pill px-2.5 py-1'
        }
      >
        <span aria-hidden>✓</span> {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-forest/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-cream rounded-3xl shadow-modal max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 bg-success-tint border border-mint rounded-xl flex items-center justify-center text-lg">
                ✓
              </span>
              <div>
                <div className="font-display text-lg text-forest">Verified Record</div>
                <div className="text-[11px] text-ink-subtle">
                  Iloja-certified, timestamped, tamper-proof.
                </div>
              </div>
            </div>

            {loading && <p className="text-sm text-ink-muted">Loading…</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
            {doc && <DocumentBody doc={doc} />}

            <button
              onClick={() => setOpen(false)}
              className="mt-5 w-full bg-forest text-white rounded-pill py-2.5 text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DocumentBody({ doc }: { doc: DocumentResponse }) {
  const niceType: Record<DocumentResponse['type'], string> = {
    tenancy_agreement: 'Tenancy agreement',
    inspection_report: 'Inspection report',
    escrow_receipt: 'Escrow receipt',
    dispute_outcome: 'Dispute outcome',
    credibility_snapshot: 'Credibility snapshot',
  };
  const statusLabel: Record<DocumentResponse['anchorStatus'], string> = {
    pending: 'Verification pending',
    submitted: 'Verifying…',
    confirmed: 'Independently verifiable',
    failed: 'Verification queued',
  };
  return (
    <ul className="bg-white border border-line rounded-2xl divide-y divide-line text-sm">
      <li className="px-4 py-3 flex justify-between">
        <span className="text-ink-muted">Type</span>
        <span className="font-semibold text-ink">{niceType[doc.type]}</span>
      </li>
      <li className="px-4 py-3 flex justify-between">
        <span className="text-ink-muted">Created</span>
        <span className="font-semibold text-ink">
          {new Date(doc.createdAt).toLocaleString('en-NG')}
        </span>
      </li>
      <li className="px-4 py-3 flex justify-between">
        <span className="text-ink-muted">Status</span>
        <span className="font-semibold text-ink">{statusLabel[doc.anchorStatus]}</span>
      </li>
      {doc.anchorStatus === 'confirmed' && doc.txHash && (
        <li className="px-4 py-3">
          <span className="text-ink-muted block mb-1">Independently verify</span>
          <a
            href={`https://basescan.org/tx/${doc.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-info-deep underline break-all"
          >
            {doc.txHash}
          </a>
        </li>
      )}
    </ul>
  );
}
