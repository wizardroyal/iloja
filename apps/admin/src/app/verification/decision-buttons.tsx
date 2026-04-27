'use client';

import { ApiError, IlojaClient } from '@iloja/sdk';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const DEMO_ADMIN_ID = 'demo-admin-1';

function makeClient(): IlojaClient {
  return new IlojaClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    asUserId: DEMO_ADMIN_ID,
    asUserRoles: ['admin'],
  });
}

export function VerificationDecisionButtons({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve(): Promise<void> {
    setError(null);
    try {
      await makeClient().approveVerification(jobId);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Approve failed');
    }
  }

  async function reject(): Promise<void> {
    setError(null);
    if (reason.length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }
    try {
      await makeClient().rejectVerification(jobId, reason);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reject failed');
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={approve}
          disabled={pending}
          className="bg-grove text-white rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Approve
        </button>
        <button
          onClick={() => setShowReject((v) => !v)}
          disabled={pending}
          className="bg-white border border-danger text-danger rounded-pill px-4 py-2 text-sm font-semibold"
        >
          Reject
        </button>
      </div>

      {showReject && (
        <div className="mt-3 flex gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you rejecting?"
            className="flex-1 border border-line rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={reject}
            disabled={pending}
            className="bg-danger text-white rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Confirm reject
          </button>
        </div>
      )}

      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
