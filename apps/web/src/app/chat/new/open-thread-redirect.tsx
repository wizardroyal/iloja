'use client';

import { ApiError } from '@iloja/sdk';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { readSession } from '@/lib/session';

/**
 * Opens (or finds) the thread for this listing and redirects to /chat/[id].
 * Handled client-side because we need the user's bearer token for the
 * upsert; server components don't have that yet (Auth.js cookies pending).
 */
export function OpenThreadRedirect({ listingId }: { listingId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) {
      setError('Missing listing.');
      return;
    }
    const session = readSession();
    if (!session) {
      router.replace(`/login?next=/chat/new?listing=${listingId}`);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const thread = await getBrowserClient().openThread(listingId);
        if (!cancelled) router.replace(`/chat/${thread.id}`);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? `Could not open thread (${err.status})` : 'Network error',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId, router]);

  return (
    <div className="flex-1 flex items-center justify-center text-ink-muted text-sm px-6 text-center">
      {error ?? 'Opening conversation…'}
    </div>
  );
}
