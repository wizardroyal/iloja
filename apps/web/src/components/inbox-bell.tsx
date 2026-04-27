'use client';

import { ApiError } from '@iloja/sdk';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { readSession } from '@/lib/session';

/**
 * Bell icon with unread count badge. Polls /notifications/count every 30s
 * when the user is signed in. The badge collapses to "9+" past 9 to keep
 * the icon legible at small sizes.
 */
export function InboxBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!readSession()) return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const res = await getBrowserClient().unreadNotificationCount();
        if (!cancelled) setCount(res.unread);
      } catch (err) {
        // 401 means session expired — silently zero out so the dot disappears.
        if (err instanceof ApiError && err.status === 401) setCount(0);
      }
    };
    void poll();
    const id = window.setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/inbox"
      aria-label={count && count > 0 ? `Inbox · ${count} unread` : 'Inbox'}
      className="w-[38px] h-[38px] rounded-full bg-parchment border border-line flex items-center justify-center shadow-card relative"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 2a5 5 0 015 5c0 2.5-1 4.5-2.5 6L9 16l-2.5-3C5 11.5 4 9.5 4 7a5 5 0 015-5z"
          stroke="#1A3C34"
          strokeWidth="1.5"
        />
        <circle cx="9" cy="7" r="1.5" fill="#1A3C34" />
      </svg>
      {count !== null && count > 0 && (
        <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center border-[1.5px] border-cream">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
