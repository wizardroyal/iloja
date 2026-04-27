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

export function FlagDecisionButtons({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function decide(valid: boolean): Promise<void> {
    setError(null);
    if (notes.trim().length < 5) {
      setError('Decision notes must be at least 5 characters');
      return;
    }
    try {
      await makeClient().resolveFlag(flagId, { valid, decisionNotes: notes.trim() });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Decision failed');
    }
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Decision notes — what you saw, why."
        rows={2}
        className="w-full bg-white border border-line rounded-lg px-3 py-2 text-sm mb-2 resize-none"
      />
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => decide(true)}
          className="flex-1 bg-warning-tint border-2 border-warning text-warning-deep rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Uphold (pause listing)
        </button>
        <button
          disabled={pending}
          onClick={() => decide(false)}
          className="flex-1 bg-grove text-white rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
