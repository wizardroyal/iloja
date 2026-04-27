'use client';

import {
  ApiError,
  type AffiliateCategory,
  type AffiliateResponse,
} from '@iloja/sdk';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';

const CATEGORY_LABEL: Record<AffiliateCategory, string> = {
  movers: 'Movers',
  internet: 'Internet',
  dstv: 'DSTV / TV',
  cleaning: 'Cleaning',
  furniture: 'Furniture',
  utilities: 'Utilities',
};

const CATEGORY_ICON: Record<AffiliateCategory, string> = {
  movers: '🚚',
  internet: '📶',
  dstv: '📺',
  cleaning: '🧹',
  furniture: '🪑',
  utilities: '💡',
};

/**
 * Shown on the escrow success / move-in moment. Doc §6 Tier 2:
 * "perfectly timed (renter just confirmed) and require no additional
 * acquisition cost". One row per category, picks the best-ranked active
 * partner.
 */
export function AffiliateStrip({ contextRef }: { contextRef: string }) {
  const [items, setItems] = useState<AffiliateResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await getBrowserClient().listAffiliates();
        if (cancelled) return;
        // Top-ranked partner per category.
        const best = new Map<AffiliateCategory, AffiliateResponse>();
        for (const a of list) {
          const cur = best.get(a.category);
          if (!cur || a.rank < cur.rank) best.set(a.category, a);
        }
        setItems([...best.values()]);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(`API ${err.status}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;
  if (items.length === 0) return null;

  async function clickThrough(affiliateId: string): Promise<void> {
    try {
      const result = await getBrowserClient().clickAffiliate({
        affiliateId,
        contextRef,
      });
      window.open(result.redirect, '_blank', 'noopener');
    } catch {
      // Click logging failed but don't strand the user — open the partner
      // URL anyway from the cached AffiliateResponse.
      const a = items.find((i) => i.id === affiliateId);
      if (a) window.open(a.url, '_blank', 'noopener');
    }
  }

  return (
    <section className="mt-6 text-left">
      <h3 className="text-[10px] font-bold tracking-wider uppercase text-ink-subtle mb-2.5">
        Move-in services
      </h3>
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.id}
            className="bg-white border border-line rounded-2xl px-3.5 py-2.5 shadow-card flex items-center gap-3"
          >
            <span className="text-2xl flex-shrink-0">{CATEGORY_ICON[a.category]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-ink truncate">
                {a.name}
                <span className="ml-1.5 text-[10px] font-medium text-ink-subtle uppercase tracking-wider">
                  {CATEGORY_LABEL[a.category]}
                </span>
              </div>
              <div className="text-[11px] text-ink-muted line-clamp-2">{a.blurb}</div>
            </div>
            <button
              onClick={() => clickThrough(a.id)}
              className="text-[11px] font-semibold text-forest bg-parchment border border-line-soft rounded-pill px-2.5 py-1.5 whitespace-nowrap"
            >
              Open →
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
