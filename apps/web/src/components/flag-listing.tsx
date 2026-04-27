'use client';

import { ApiError } from '@iloja/sdk';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { readSession } from '@/lib/session';

/**
 * Community flag entry-point on every active listing (doc §2.3 anti-fraud
 * measures). Opens a small modal for the reason; submits to POST /flags
 * which goes into the admin queue for adjudication.
 */
export function FlagListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(): Promise<void> {
    if (reason.trim().length < 10) {
      setError('Please give us at least one full sentence so ops can review.');
      return;
    }
    if (!readSession()) {
      window.location.href = `/login?next=/listings/${listingId}`;
      return;
    }
    setPending(true);
    setError(null);
    try {
      await getBrowserClient().flagListing({ listingId, reason: reason.trim() });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? `Submit failed (${err.status})` : 'Network error');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setDone(false);
          setError(null);
        }}
        className="text-[10px] text-ink-subtle underline-offset-2 hover:underline"
      >
        Report listing
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
            {done ? (
              <>
                <h2 className="font-display text-xl text-forest mb-2">Thanks — flagged</h2>
                <p className="text-sm text-ink-muted mb-4">
                  Iloja ops will review this within 24 hours. If it&apos;s upheld the listing
                  is paused immediately.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full bg-forest text-white rounded-pill py-2.5 text-sm font-semibold"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl text-forest mb-2">Report this listing</h2>
                <p className="text-sm text-ink-muted mb-3">
                  What&apos;s wrong? E.g. doesn&apos;t match photos, agent is unresponsive,
                  property doesn&apos;t exist.
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Be specific so ops can verify."
                  className="w-full bg-white border border-line rounded-xl px-3 py-2.5 text-sm focus:border-forest focus:outline-none resize-none mb-3"
                />
                {error && <p className="text-xs text-danger mb-2">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 bg-white border border-line text-ink-muted rounded-pill py-2.5 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={pending}
                    onClick={submit}
                    className="flex-[2] bg-danger text-white rounded-pill py-2.5 text-sm font-semibold disabled:opacity-40"
                  >
                    {pending ? 'Submitting…' : 'Submit flag'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
