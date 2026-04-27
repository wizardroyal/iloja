import type { VerificationJobResponse } from '@iloja/sdk';
import Link from 'next/link';
import { getOperatorClient } from '@/lib/api';
import { OperatorJobCard } from './job-card';

export const metadata = { title: 'Operator portal · Iloja Ops' };

async function loadJobs(): Promise<{
  unclaimed: VerificationJobResponse[];
  claimed: VerificationJobResponse[];
}> {
  try {
    const client = getOperatorClient();
    const [unclaimed, claimed] = await Promise.all([
      client.listVerificationJobs('unclaimed'),
      client.listVerificationJobs('claimed'),
    ]);
    return { unclaimed, claimed };
  } catch {
    return { unclaimed: [], claimed: [] };
  }
}

export default async function OperatorPage() {
  const { unclaimed, claimed } = await loadJobs();

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/" className="text-sm text-grove font-semibold mb-2 inline-block">
        ← All surfaces
      </Link>
      <h1 className="font-display text-3xl text-forest mb-1">Operator portal</h1>
      <p className="text-ink-muted mb-8">Claim a job, walk the property, capture media, submit.</p>

      <h2 className="font-display text-xl text-forest mb-3">Your active jobs</h2>
      {claimed.length === 0 ? (
        <p className="text-ink-subtle text-sm mb-8">Nothing claimed yet.</p>
      ) : (
        <ul className="space-y-3 mb-8">
          {claimed.map((job) => (
            <OperatorJobCard key={job.id} job={job} action="submit" />
          ))}
        </ul>
      )}

      <h2 className="font-display text-xl text-forest mb-3">Available jobs</h2>
      {unclaimed.length === 0 ? (
        <p className="text-ink-subtle text-sm">Nothing waiting. Check back later.</p>
      ) : (
        <ul className="space-y-3">
          {unclaimed.map((job) => (
            <OperatorJobCard key={job.id} job={job} action="claim" />
          ))}
        </ul>
      )}
    </main>
  );
}
