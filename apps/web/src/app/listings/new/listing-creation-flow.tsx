'use client';

import { ApiError, type ListingDraftInput } from '@iloja/sdk';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { readSession } from '@/lib/session';

type ListingType = 'short_let' | 'long_term' | 'commercial';
type PricePeriod = 'night' | 'week' | 'month' | 'year';

type Draft = {
  type?: ListingType;
  title?: string;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  priceNgn?: number;
  pricePeriod?: PricePeriod;
  neighborhood?: string;
  address?: string;
};

const TYPE_OPTIONS: { value: ListingType; label: string; sub: string }[] = [
  { value: 'short_let', label: 'Short-let', sub: 'Daily / weekly furnished' },
  { value: 'long_term', label: 'Long-term', sub: 'Annual or biannual lease' },
  { value: 'commercial', label: 'Commercial', sub: 'Shops, offices, warehouses' },
];

export function ListingCreationFlow() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [draft, setDraft] = useState<Draft>({});
  const [listingId, setListingId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => getBrowserClient(), []);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.push('/login');
    } else {
      setAuthed(true);
    }
  }, [router]);

  async function persistDraft(): Promise<void> {
    if (!draft.type) return;
    const payload: ListingDraftInput = {
      type: draft.type,
      title: draft.title,
      description: draft.description,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      priceKobo:
        draft.priceNgn !== undefined ? String(BigInt(draft.priceNgn) * BigInt(100)) : undefined,
      pricePeriod: draft.pricePeriod,
      neighborhood: draft.neighborhood,
      address: draft.address,
    };
    try {
      if (listingId) {
        await client.updateListingDraft(listingId, payload);
      } else {
        const created = await client.createListingDraft(payload);
        setListingId(created.id);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) setError(`Saved locally — API ${err.status}`);
      else setError('Saved locally — API unreachable');
    }
  }

  async function uploadPhoto(file: File): Promise<void> {
    if (!listingId) {
      setError('Save details first.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('JPEG, PNG, or WebP only.');
      return;
    }
    try {
      const presigned = await client.presignListingPhoto({
        listingId,
        contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      });
      // Real PUT to R2. Will silently fail against the null-storage stub —
      // we still record the publicUrl so the API has a row to work with.
      try {
        await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': file.type },
          body: file,
        });
      } catch {
        // Stub URL won't actually accept the upload — that's fine in dev.
      }
      const photo = await client.addListingPhoto(listingId, {
        url: presigned.publicUrl,
        position: photoUrls.length,
      });
      setPhotoUrls((urls) => [...urls, photo.url]);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? `Upload failed: ${err.status}` : 'Upload failed');
    }
  }

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await persistDraft();
      if (!listingId) {
        throw new Error('Draft not yet created');
      }
      await client.submitListing(listingId);
      setStep(4);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Submit failed (${err.status}): ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Submit failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (authed === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
        Loading…
      </div>
    );
  }

  return (
    <>
      <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-line">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : 1))}
          className="text-grove text-sm font-semibold disabled:opacity-30"
          disabled={step === 1 || step === 4}
          aria-label="Back"
        >
          ← Back
        </button>
        <span className="font-display text-lg text-forest">New listing</span>
        <span className="text-xs text-ink-subtle w-10 text-right">
          {step < 4 ? `${step} / 3` : ''}
        </span>
      </header>

      <ProgressBar step={step} />

      <div className="flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {step === 1 && (
          <StepType
            value={draft.type}
            onPick={(t) => {
              setDraft((d) => ({ ...d, type: t }));
            }}
          />
        )}
        {step === 2 && <StepDetails draft={draft} setDraft={setDraft} />}
        {step === 3 && (
          <StepPhotos
            photos={photoUrls}
            onUpload={uploadPhoto}
            hasListingId={!!listingId}
          />
        )}
        {step === 4 && <StepSubmitted />}

        {error && (
          <p className="mt-4 text-xs text-danger bg-warning-tint border border-warning rounded-lg p-3">
            {error}
          </p>
        )}
      </div>

      {step !== 4 && (
        <footer className="px-5 pb-6 pt-3 border-t border-line flex-shrink-0 bg-cream">
          {step < 3 ? (
            <button
              disabled={!canAdvance(step, draft) || submitting}
              onClick={async () => {
                await persistDraft();
                setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
              }}
              className="w-full bg-forest text-white rounded-pill py-3.5 font-semibold text-sm disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={submit}
              className="w-full bg-forest text-white rounded-pill py-3.5 font-semibold text-sm disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : 'Submit for verification'}
            </button>
          )}
        </footer>
      )}
    </>
  );
}

function canAdvance(step: 1 | 2 | 3 | 4, draft: Draft): boolean {
  if (step === 1) return !!draft.type;
  if (step === 2) {
    return Boolean(
      draft.title &&
        draft.title.length >= 8 &&
        draft.description &&
        draft.description.length >= 20 &&
        typeof draft.bedrooms === 'number' &&
        typeof draft.bathrooms === 'number' &&
        typeof draft.priceNgn === 'number' &&
        draft.priceNgn > 0 &&
        draft.pricePeriod &&
        draft.neighborhood &&
        draft.address,
    );
  }
  return true;
}

function ProgressBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  const pct = step === 4 ? 100 : ((step - 1) / 3) * 100;
  return (
    <div className="px-5 pt-3 pb-2 flex-shrink-0">
      <div className="h-1 bg-parchment rounded-full overflow-hidden">
        <div
          className="h-full bg-grove transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
        />
      </div>
    </div>
  );
}

function StepType({
  value,
  onPick,
}: {
  value: ListingType | undefined;
  onPick: (t: ListingType) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-forest mb-2">What are you listing?</h2>
      <p className="text-sm text-ink-muted mb-5">Pick the category. You can change it later.</p>
      <div className="space-y-2">
        {TYPE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onPick(opt.value)}
              className={`w-full text-left rounded-2xl border-2 px-4 py-4 transition ${
                selected
                  ? 'border-forest bg-success-tint'
                  : 'border-line bg-white hover:border-line-soft'
              }`}
            >
              <div className="font-display text-lg text-forest">{opt.label}</div>
              <div className="text-xs text-ink-muted mt-0.5">{opt.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepDetails({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-forest mb-2">Tell us about it</h2>
      <p className="text-sm text-ink-muted mb-5">
        Fields that go on the listing. Keep it accurate — discrepancies dock your credibility.
      </p>

      <div className="space-y-4">
        <Field label="Listing title">
          <input
            value={draft.title ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="2-bedroom apartment, self-contained"
            className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="What makes this place worth living in?"
            rows={4}
            className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms">
            <input
              type="number"
              min={0}
              max={20}
              value={draft.bedrooms ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  bedrooms: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
            />
          </Field>
          <Field label="Bathrooms">
            <input
              type="number"
              min={0}
              max={20}
              value={draft.bathrooms ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  bathrooms: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Price (₦)">
              <input
                type="number"
                min={0}
                value={draft.priceNgn ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    priceNgn: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder={draft.type === 'short_let' ? '55000' : '1200000'}
                className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
              />
            </Field>
          </div>
          <Field label="Per">
            <select
              value={draft.pricePeriod ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pricePeriod: e.target.value as PricePeriod }))
              }
              className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
            >
              <option value="">—</option>
              <option value="night">night</option>
              <option value="week">week</option>
              <option value="month">month</option>
              <option value="year">year</option>
            </select>
          </Field>
        </div>

        <Field label="Neighborhood">
          <input
            value={draft.neighborhood ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))}
            placeholder="Yaba"
            className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
          />
        </Field>

        <Field label="Full address">
          <input
            value={draft.address ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            placeholder="12 Herbert Macaulay Way, Yaba, Lagos"
            className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
          />
          <p className="text-[11px] text-ink-subtle mt-1">
            Geocoded server-side; the operator&apos;s GPS is cross-checked against this.
          </p>
        </Field>
      </div>
    </div>
  );
}

function StepPhotos({
  photos,
  onUpload,
  hasListingId,
}: {
  photos: string[];
  onUpload: (f: File) => void;
  hasListingId: boolean;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-forest mb-2">Add photos</h2>
      <p className="text-sm text-ink-muted mb-5">
        At least 3 wide shots of the main rooms. The operator captures the rest during verification.
      </p>

      <label className="block border-2 border-dashed border-line-soft rounded-2xl px-4 py-12 text-center bg-white cursor-pointer">
        <div className="text-4xl mb-2">📸</div>
        <p className="text-sm font-medium text-ink mb-1">Tap to upload</p>
        <p className="text-xs text-ink-subtle">JPG, PNG, or WebP · up to 10MB each</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={!hasListingId}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
      </label>

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {photos.map((url, idx) => (
            <li
              key={url}
              className="aspect-square rounded-lg bg-parchment text-[10px] text-ink-subtle flex items-center justify-center text-center px-2"
            >
              Photo {idx + 1}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepSubmitted() {
  return (
    <div className="text-center pt-10">
      <div className="w-20 h-20 mx-auto bg-success-tint rounded-full flex items-center justify-center mb-5">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12l5 5L20 7"
            stroke="#2D6A4F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="font-display text-2xl text-forest mb-2">Submitted for verification</h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-6">
        An Iloja operator will visit the property and capture a verified walkthrough. You&apos;ll
        get a notification when the listing goes live — usually within 48 hours.
      </p>
      <a
        href="/"
        className="inline-block bg-forest text-white rounded-pill py-3 px-7 text-sm font-semibold"
      >
        Back to home
      </a>
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
