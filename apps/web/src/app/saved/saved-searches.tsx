'use client';

import { ApiError, type SavedSearchResponse } from '@iloja/sdk';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { formatNairaFromKobo } from '@/lib/sample-listings';
import { readSession } from '@/lib/session';

type ListingType = 'short_let' | 'long_term' | 'commercial';

export function SavedSearches() {
  const router = useRouter();
  const [items, setItems] = useState<SavedSearchResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await getBrowserClient().listMySavedSearches();
      setItems(list);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login?next=/saved');
        return;
      }
      setError(err instanceof ApiError ? `API ${err.status}` : 'Network error');
    }
  }, [router]);

  useEffect(() => {
    if (!readSession()) {
      router.replace('/login?next=/saved');
      return;
    }
    void refresh();
  }, [refresh, router]);

  async function remove(id: string): Promise<void> {
    await getBrowserClient().deleteSavedSearch(id);
    await refresh();
  }

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
        <span className="font-display text-lg text-forest">Saved searches</span>
        <button
          onClick={() => setCreating((v) => !v)}
          className="text-xs font-semibold text-grove bg-success-tint border border-mint rounded-pill px-3 py-1.5"
        >
          {creating ? 'Cancel' : '+ New'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {creating && <NewSavedSearchForm onDone={() => { setCreating(false); void refresh(); }} />}

        {items.length === 0 ? (
          <p className="text-center text-sm text-ink-subtle py-12">
            Save a search to get notified the moment a verified listing matches your filters.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((s) => (
              <li
                key={s.id}
                className="bg-white border border-line rounded-2xl p-3.5 shadow-card flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base text-forest mb-1">
                    {s.label || formatSummary(s)}
                  </div>
                  <div className="text-[11px] text-ink-subtle">{formatSummary(s)}</div>
                  <div className="text-[10px] text-ink-subtle mt-1">
                    {s.lastAlertedAt
                      ? `Last alert ${new Date(s.lastAlertedAt).toLocaleDateString('en-NG')}`
                      : 'No matches yet'}
                  </div>
                </div>
                <button
                  onClick={() => remove(s.id)}
                  className="text-[11px] font-semibold text-danger underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function formatSummary(s: SavedSearchResponse): string {
  const parts: string[] = [];
  if (s.type) parts.push(s.type.replace('_', ' '));
  if (s.bedrooms !== null) parts.push(`${s.bedrooms} bed`);
  if (s.neighborhood) parts.push(s.neighborhood);
  if (s.minPriceKobo || s.maxPriceKobo) {
    const lo = s.minPriceKobo ? formatNairaFromKobo(s.minPriceKobo) : '₦0';
    const hi = s.maxPriceKobo ? formatNairaFromKobo(s.maxPriceKobo) : '∞';
    parts.push(`${lo} – ${hi}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Any listing';
}

function NewSavedSearchForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ListingType | ''>('');
  const [neighborhood, setNeighborhood] = useState('');
  const [bedrooms, setBedrooms] = useState<number | ''>('');
  const [minNgn, setMinNgn] = useState<number | ''>('');
  const [maxNgn, setMaxNgn] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const hasFilter =
        !!type || !!neighborhood || bedrooms !== '' || minNgn !== '' || maxNgn !== '';
      if (!hasFilter) {
        setError('Pick at least one filter — otherwise every listing alerts you.');
        return;
      }
      await getBrowserClient().createSavedSearch({
        label: label.trim() || undefined,
        type: type || undefined,
        neighborhood: neighborhood.trim() || undefined,
        bedrooms: bedrooms === '' ? undefined : bedrooms,
        minPriceKobo:
          minNgn === '' ? undefined : String(BigInt(minNgn) * BigInt(100)),
        maxPriceKobo:
          maxNgn === '' ? undefined : String(BigInt(maxNgn) * BigInt(100)),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? `API ${err.status}` : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-card mb-4">
      <h3 className="font-display text-base text-forest mb-3">New saved search</h3>
      <div className="space-y-3">
        <Field label="Label (optional)">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Yaba 2-bed under ₦1.2M"
            className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:border-forest focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ListingType | '')}
              className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:border-forest focus:outline-none"
            >
              <option value="">Any</option>
              <option value="short_let">Short-let</option>
              <option value="long_term">Long-term</option>
              <option value="commercial">Commercial</option>
            </select>
          </Field>
          <Field label="Bedrooms">
            <input
              type="number"
              min={0}
              max={20}
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:border-forest focus:outline-none"
            />
          </Field>
        </div>
        <Field label="Neighborhood">
          <input
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="Yaba"
            className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:border-forest focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min ₦">
            <input
              type="number"
              min={0}
              value={minNgn}
              onChange={(e) => setMinNgn(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:border-forest focus:outline-none"
            />
          </Field>
          <Field label="Max ₦">
            <input
              type="number"
              min={0}
              value={maxNgn}
              onChange={(e) => setMaxNgn(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:border-forest focus:outline-none"
            />
          </Field>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          disabled={pending}
          onClick={submit}
          className="w-full bg-forest text-white rounded-pill py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save search'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
