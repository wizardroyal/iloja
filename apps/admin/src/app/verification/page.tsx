import type { VerificationJobResponse } from '@iloja/sdk';
import Link from 'next/link';
import { getAdminClient } from '@/lib/api';
import { VerificationDecisionButtons } from './decision-buttons';

export const metadata = { title: 'Verification queue · Iloja Ops' };

async function loadSubmitted(): Promise<VerificationJobResponse[]> {
  try {
    const client = getAdminClient();
    return await client.listVerificationJobs('submitted');
  } catch {
    return [];
  }
}

async function loadUnclaimed(): Promise<VerificationJobResponse[]> {
  try {
    const client = getAdminClient();
    return await client.listVerificationJobs('unclaimed');
  } catch {
    return [];
  }
}

export default async function VerificationQueuePage() {
  const [submitted, unclaimed] = await Promise.all([loadSubmitted(), loadUnclaimed()]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-grove font-semibold mb-2 inline-block">
            ← All surfaces
          </Link>
          <h1 className="font-display text-3xl text-forest">Verification queue</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="bg-warning-tint text-warning-deep rounded-pill px-3 py-1 font-semibold">
            {submitted.length} awaiting review
          </span>
          <span className="bg-parchment text-ink-muted rounded-pill px-3 py-1 font-semibold">
            {unclaimed.length} unclaimed
          </span>
        </div>
      </header>

      {submitted.length === 0 ? (
        <p className="text-ink-muted">Nothing awaiting review.</p>
      ) : (
        <ul className="space-y-3">
          {submitted.map((job) => (
            <li
              key={job.id}
              className="bg-white border border-line rounded-2xl p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="font-display text-lg text-forest">
                    {job.listing?.title ?? 'Listing'}
                  </div>
                  <div className="text-xs text-ink-subtle mt-0.5">
                    {job.listing?.neighborhood} ·{' '}
                    {job.listing?.bedrooms !== undefined ? `${job.listing.bedrooms} bed · ` : ''}
                    {job.listing?.address}
                  </div>
                </div>
                <GpsBadge mismatchM={job.gpsMismatchMetres} />
              </div>

              {job.artefacts && job.artefacts.length > 0 && (
                <div className="text-xs text-ink-muted mb-3">
                  {job.artefacts.length} artefact{job.artefacts.length === 1 ? '' : 's'} captured
                </div>
              )}

              <VerificationDecisionButtons jobId={job.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function GpsBadge({ mismatchM }: { mismatchM: number | null }) {
  if (mismatchM === null) {
    return (
      <span className="text-[11px] font-semibold bg-parchment text-ink-muted px-2.5 py-1 rounded-pill">
        no GPS
      </span>
    );
  }
  const flagged = mismatchM > 200;
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill ${
        flagged ? 'bg-warning-tint text-warning-deep' : 'bg-success-tint text-grove'
      }`}
    >
      {flagged ? '⚠ ' : '✓ '}
      {Math.round(mismatchM)}m
    </span>
  );
}
