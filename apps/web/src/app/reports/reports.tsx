'use client';

import { ApiError, type ListingFlagResponse } from '@iloja/sdk';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { readSession } from '@/lib/session';

const STATUS_LABEL: Record<ListingFlagResponse['status'], string> = {
  open: 'Under review',
  resolved_valid: 'Upheld',
  resolved_invalid: 'Dismissed',
};

const STATUS_TONE: Record<ListingFlagResponse['status'], string> = {
  open: 'bg-warning-tint text-warning-deep border-warning/40',
  resolved_valid: 'bg-success-tint text-grove border-mint',
  resolved_invalid: 'bg-parchment text-ink-muted border-line',
};

export function Reports() {
  const router = useRouter();
  const [items, setItems] = useState<ListingFlagResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!readSession()) {
      router.replace('/login?next=/reports');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await getBrowserClient().listMyFlags();
        if (!cancelled) setItems(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? `API ${err.status}` : 'Network error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!items) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
        {error ?? 'Loading…'}
      </div>
    );
  }

  return (
    <>
      <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-line bg-cream">
        <Link href="/" className="text-grove text-sm font-semibold">
          ←
        </Link>
        <span className="font-display text-lg text-forest">Your reports</span>
        <span className="w-6" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.length === 0 ? (
          <p className="text-center text-sm text-ink-subtle py-12">
            You haven&apos;t reported any listings. Use the &quot;Report listing&quot; link on
            any listing detail page if something looks off.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((f) => (
              <li
                key={f.id}
                className="bg-white border border-line rounded-2xl p-3.5 shadow-card"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <Link
                    href={`/listings/${f.listingId}`}
                    className="text-xs font-semibold text-forest underline-offset-2 hover:underline truncate"
                  >
                    Listing {f.listingId.slice(0, 8)}…
                  </Link>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill border ${STATUS_TONE[f.status]}`}
                  >
                    {STATUS_LABEL[f.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed mb-2 line-clamp-3">
                  {f.reason}
                </p>
                <div className="text-[10px] text-ink-subtle">
                  Submitted{' '}
                  {new Date(f.createdAt).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {f.resolvedAt && (
                    <>
                      {' · resolved '}
                      {new Date(f.resolvedAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </>
                  )}
                </div>
                {f.decisionNotes && (
                  <p className="mt-1.5 text-[11px] text-ink-muted bg-parchment border border-line rounded-lg p-2">
                    Ops note: {f.decisionNotes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
