'use client';

import { ApiError, IlojaClient, type VerificationJobResponse } from '@iloja/sdk';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const DEMO_OPERATOR_ID = 'demo-operator-1';

function makeClient(): IlojaClient {
  return new IlojaClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    asUserId: DEMO_OPERATOR_ID,
    asUserRoles: ['operator'],
  });
}

export function OperatorJobCard({
  job,
  action,
}: {
  job: VerificationJobResponse;
  action: 'claim' | 'submit';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function claim(): Promise<void> {
    setError(null);
    try {
      await makeClient().claimVerificationJob(job.id);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Claim failed');
    }
  }

  /**
   * Sprint-1 stub submission: use the listing's geocoded address as the
   * "captured" GPS so the GPS-mismatch path runs end-to-end. Real submissions
   * will come from the operator's mobile app with photo/video uploads to R2.
   */
  async function submitStub(): Promise<void> {
    setError(null);
    if (!job.listing) {
      setError('Listing not loaded');
      return;
    }
    try {
      await makeClient().submitVerification(job.id, {
        artefacts: [
          {
            kind: 'photo',
            url: 'https://example.com/stub-photo-1.jpg',
            capturedAt: new Date().toISOString(),
            lat: job.listing.lat,
            lng: job.listing.lng,
          },
          {
            kind: 'photo',
            url: 'https://example.com/stub-photo-2.jpg',
            capturedAt: new Date().toISOString(),
            lat: job.listing.lat,
            lng: job.listing.lng,
          },
          {
            kind: 'video',
            url: 'https://example.com/stub-walkthrough.mp4',
            capturedAt: new Date().toISOString(),
            lat: job.listing.lat,
            lng: job.listing.lng,
          },
        ],
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submit failed');
    }
  }

  return (
    <li className="bg-white border border-line rounded-2xl p-5 shadow-card flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-display text-lg text-forest truncate">
          {job.listing?.title ?? 'Listing'}
        </div>
        <div className="text-xs text-ink-subtle mt-0.5">
          {job.listing?.neighborhood} · {job.listing?.address}
        </div>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
      <button
        onClick={action === 'claim' ? claim : submitStub}
        disabled={pending}
        className="bg-forest text-white rounded-pill px-4 py-2 text-sm font-semibold whitespace-nowrap disabled:opacity-40"
      >
        {action === 'claim' ? 'Claim job' : 'Submit walkthrough'}
      </button>
    </li>
  );
}
