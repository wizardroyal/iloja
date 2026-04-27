'use client';

import { ApiError, type NotificationResponse } from '@iloja/sdk';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { readSession } from '@/lib/session';

export function Inbox() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await getBrowserClient().listNotifications();
      setItems(list);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login?next=/inbox');
        return;
      }
      setError(err instanceof ApiError ? `API ${err.status}` : 'Network error');
    }
  }, [router]);

  useEffect(() => {
    if (!readSession()) {
      router.replace('/login?next=/inbox');
      return;
    }
    void refresh();
  }, [refresh, router]);

  async function markAllRead(): Promise<void> {
    await getBrowserClient().markNotificationsRead();
    await refresh();
  }

  if (!items) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
        {error ?? 'Loading…'}
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <>
      <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-line bg-cream">
        <span className="font-display text-2xl text-forest tracking-tight">Inbox</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-grove font-semibold underline-offset-2 hover:underline"
          >
            Mark all read
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.length === 0 ? (
          <p className="text-center text-sm text-ink-subtle py-12 px-6">
            Nothing yet. Listings, offers, and escrow updates will land here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function NotificationRow({ n }: { n: NotificationResponse }) {
  const inner = (
    <div className="px-5 py-3 flex items-start gap-3">
      <span
        className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
          n.readAt ? 'bg-transparent' : 'bg-danger'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink truncate">{n.title}</span>
          <span className="text-[10px] text-ink-subtle whitespace-nowrap">
            {new Date(n.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.body}</p>
      </div>
    </div>
  );
  return n.href ? <Link href={n.href}>{inner}</Link> : inner;
}
