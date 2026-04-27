'use client';

import {
  ApiError,
  type ChatMessageResponse,
  type IlojaClient,
  type InspectionResponse,
  type OfferEventResponse,
  type ThreadResponse,
} from '@iloja/sdk';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { formatNairaFromKobo } from '@/lib/sample-listings';
import { readSession } from '@/lib/session';

interface BootstrapState {
  thread: ThreadResponse;
  messages: ChatMessageResponse[];
  offers: OfferEventResponse[];
  inspections: InspectionResponse[];
  meId: string;
}

/**
 * Polling-based chat room. Real-time over Socket.io is the next pass — the
 * Sprint-3 priority is the structured offer + inspection booking surface, not
 * sub-second message latency. 4-second poll feels live enough on Lagos 4G.
 */
export function ChatRoom({ threadId }: { threadId: string }) {
  const router = useRouter();
  const client = useMemo(() => getBrowserClient(), []);
  const [state, setState] = useState<BootstrapState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [thread, messages, offers, inspections] = await Promise.all([
        client.getThread(threadId),
        client.listMessages(threadId),
        client.listOffers(threadId),
        client.listInspections(threadId),
      ]);
      const session = readSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      setState({ thread, messages, offers, inspections, meId: session.userId });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? `API ${err.status}` : 'Network error');
    }
  }, [client, threadId, router]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 4000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
        {error ?? 'Loading…'}
      </div>
    );
  }

  const { thread, messages, offers, inspections, meId } = state;
  const latestOffer: OfferEventResponse | null = offers[offers.length - 1] ?? null;
  const items = mergeTimeline(messages, offers, inspections);
  const isAgent = thread.agentId === meId;

  return (
    <>
      <Header thread={thread} />

      <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.length === 0 ? (
          <p className="text-center text-xs text-ink-subtle py-8">
            Send the first message to start the conversation.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                {item.kind === 'message' ? (
                  <MessageBubble msg={item.msg} mine={item.msg.byUserId === meId} />
                ) : item.kind === 'offer' ? (
                  <OfferCard
                    event={item.event}
                    mine={item.event.byUserId === meId}
                    client={client}
                    threadId={threadId}
                    isLatest={item.event.id === latestOffer?.id}
                    onChange={refresh}
                  />
                ) : (
                  <InspectionCard inspection={item.inspection} mine={item.inspection.byUserId === meId} client={client} onChange={refresh} />
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-[11px] text-danger mt-2 text-center">{error}</p>}
      </div>

      <ActionBar
        client={client}
        threadId={threadId}
        latestOffer={latestOffer}
        isAgent={isAgent}
        meId={meId}
        onChange={refresh}
      />
    </>
  );
}

function Header({ thread }: { thread: ThreadResponse }) {
  return (
    <header className="px-5 pt-4 pb-3 flex items-center gap-3 flex-shrink-0 border-b border-line bg-cream">
      <Link href="/" className="text-grove text-sm font-semibold">
        ←
      </Link>
      <Link
        href={`/listings/${thread.listingId}`}
        className="flex-1 min-w-0 flex items-center gap-2"
      >
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-grove to-forest text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
          🏠
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">Listing conversation</div>
          <div className="text-[11px] text-ink-subtle">View listing →</div>
        </div>
      </Link>
    </header>
  );
}

function MessageBubble({ msg, mine }: { msg: ChatMessageResponse; mine: boolean }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm shadow-card ${
          mine ? 'bg-forest text-white rounded-br-md' : 'bg-white border border-line text-ink rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-wrap leading-snug">{msg.body}</p>
        <p
          className={`text-[10px] mt-1 ${mine ? 'text-mint/75 text-right' : 'text-ink-subtle'}`}
        >
          {new Date(msg.createdAt).toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

function OfferCard({
  event,
  mine,
  client,
  threadId,
  isLatest,
  onChange,
}: {
  event: OfferEventResponse;
  mine: boolean;
  client: IlojaClient;
  threadId: string;
  isLatest: boolean;
  onChange: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const showActions =
    isLatest && !mine && (event.type === 'offer_made' || event.type === 'counter_offer');
  const showWithdraw =
    isLatest && mine && (event.type === 'offer_made' || event.type === 'counter_offer');

  async function action(fn: () => Promise<unknown>): Promise<void> {
    setPending(true);
    try {
      await fn();
      await onChange();
    } finally {
      setPending(false);
    }
  }

  const tagText: Record<OfferEventResponse['type'], string> = {
    offer_made: 'Offer',
    counter_offer: 'Counter',
    accepted: '✓ Accepted',
    declined: '✕ Declined',
    withdrawn: 'Withdrawn',
  };

  return (
    <div
      className={`mx-auto max-w-[88%] rounded-2xl border-2 px-4 py-3.5 ${
        event.type === 'accepted'
          ? 'border-grove bg-success-tint'
          : event.type === 'declined' || event.type === 'withdrawn'
            ? 'border-line bg-parchment opacity-70'
            : 'border-forest bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-grove">
          {tagText[event.type]}
        </span>
        <span className="text-[10px] text-ink-subtle">
          {new Date(event.createdAt).toLocaleString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>
      {event.amountKobo && (
        <div className="font-display text-2xl text-forest mb-1">
          {formatNairaFromKobo(event.amountKobo)}
        </div>
      )}
      {event.termsSummary && (
        <p className="text-xs text-ink-muted mb-2">{event.termsSummary}</p>
      )}
      {showActions && (
        <div className="flex gap-2 mt-2">
          <button
            disabled={pending}
            onClick={() => action(() => client.acceptOffer(threadId))}
            className="flex-1 bg-grove text-white text-xs font-semibold rounded-pill py-2 disabled:opacity-40"
          >
            Accept
          </button>
          <button
            disabled={pending}
            onClick={() => action(() => client.declineOffer(threadId))}
            className="flex-1 bg-white border border-danger text-danger text-xs font-semibold rounded-pill py-2 disabled:opacity-40"
          >
            Decline
          </button>
        </div>
      )}
      {showWithdraw && (
        <button
          disabled={pending}
          onClick={() => action(() => client.withdrawOffer(threadId))}
          className="mt-2 text-[11px] text-ink-subtle underline disabled:opacity-40"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

function InspectionCard({
  inspection,
  mine,
  client,
  onChange,
}: {
  inspection: InspectionResponse;
  mine: boolean;
  client: IlojaClient;
  onChange: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const at = new Date(inspection.scheduledAt);
  const status = inspection.status;
  const labels: Record<typeof status, string> = {
    proposed: 'Proposed',
    confirmed: '✓ Confirmed',
    cancelled: '✕ Cancelled',
    completed: 'Completed',
    no_show: 'No-show',
  };

  async function confirm(): Promise<void> {
    setPending(true);
    try {
      await client.confirmInspection(inspection.id);
      await onChange();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[88%] bg-white border border-line rounded-2xl px-4 py-3 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-info-deep">
          Inspection · {labels[status]}
        </span>
      </div>
      <div className="font-display text-base text-forest">
        {at.toLocaleString('en-NG', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
      {status === 'proposed' && !mine && (
        <button
          disabled={pending}
          onClick={confirm}
          className="mt-2 bg-forest text-white text-xs font-semibold rounded-pill py-2 px-4 disabled:opacity-40"
        >
          Confirm slot
        </button>
      )}
    </div>
  );
}

function ActionBar({
  client,
  threadId,
  latestOffer,
  isAgent,
  meId,
  onChange,
}: {
  client: IlojaClient;
  threadId: string;
  latestOffer: OfferEventResponse | null;
  isAgent: boolean;
  meId: string;
  onChange: () => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [showOffer, setShowOffer] = useState(false);
  const [offerNgn, setOfferNgn] = useState<number | ''>('');
  const [showInspection, setShowInspection] = useState(false);
  const [inspectionAt, setInspectionAt] = useState('');
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOfferOpen =
    latestOffer && (latestOffer.type === 'offer_made' || latestOffer.type === 'counter_offer');
  const canMakeOffer = !isOfferOpen || (latestOffer && latestOffer.byUserId !== meId);

  async function send(): Promise<void> {
    const body = draft.trim();
    if (!body) return;
    setPending(true);
    try {
      await client.sendMessage(threadId, body);
      setDraft('');
      await onChange();
      inputRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function makeOffer(): Promise<void> {
    if (typeof offerNgn !== 'number' || offerNgn <= 0) return;
    setPending(true);
    try {
      await client.makeOffer(threadId, {
        amountKobo: String(BigInt(offerNgn) * BigInt(100)),
      });
      setOfferNgn('');
      setShowOffer(false);
      await onChange();
    } finally {
      setPending(false);
    }
  }

  async function proposeInspection(): Promise<void> {
    if (!inspectionAt) return;
    setPending(true);
    try {
      await client.proposeInspection({
        threadId,
        scheduledAt: new Date(inspectionAt).toISOString(),
      });
      setInspectionAt('');
      setShowInspection(false);
      await onChange();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-t border-line bg-cream flex-shrink-0">
      {showOffer && (
        <div className="px-4 py-3 bg-white border-b border-line">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block mb-1.5">
              {isAgent ? 'Counter offer' : 'Offer amount'} (₦)
            </span>
            <input
              type="number"
              min={0}
              value={offerNgn}
              onChange={(e) => setOfferNgn(e.target.value ? Number(e.target.value) : '')}
              placeholder={isAgent ? '900,000' : '750,000'}
              className="w-full bg-white border border-line rounded-xl px-3.5 py-2.5 text-base focus:border-forest focus:outline-none"
            />
          </label>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowOffer(false)}
              className="flex-1 text-xs font-semibold text-ink-muted py-2"
            >
              Cancel
            </button>
            <button
              disabled={pending || !offerNgn}
              onClick={makeOffer}
              className="flex-[2] bg-forest text-white text-xs font-semibold rounded-pill py-2 disabled:opacity-40"
            >
              Send offer
            </button>
          </div>
        </div>
      )}

      {showInspection && (
        <div className="px-4 py-3 bg-white border-b border-line">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block mb-1.5">
              Inspection slot
            </span>
            <input
              type="datetime-local"
              value={inspectionAt}
              onChange={(e) => setInspectionAt(e.target.value)}
              className="w-full bg-white border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none"
            />
          </label>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowInspection(false)}
              className="flex-1 text-xs font-semibold text-ink-muted py-2"
            >
              Cancel
            </button>
            <button
              disabled={pending || !inspectionAt}
              onClick={proposeInspection}
              className="flex-[2] bg-forest text-white text-xs font-semibold rounded-pill py-2 disabled:opacity-40"
            >
              Propose slot
            </button>
          </div>
        </div>
      )}

      <div className="px-3 pt-2 pb-1 flex gap-2">
        <button
          onClick={() => {
            setShowOffer((v) => !v);
            setShowInspection(false);
          }}
          disabled={!canMakeOffer}
          className="text-[11px] font-semibold text-grove bg-success-tint border border-mint rounded-pill px-2.5 py-1 disabled:opacity-40"
        >
          {isAgent ? 'Counter' : 'Make offer'}
        </button>
        <button
          onClick={() => {
            setShowInspection((v) => !v);
            setShowOffer(false);
          }}
          className="text-[11px] font-semibold text-forest bg-parchment border border-line-soft rounded-pill px-2.5 py-1"
        >
          Schedule inspection
        </button>
      </div>

      <div className="px-3 pb-5 pt-1 flex items-end gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type a message"
          className="flex-1 bg-white border border-line rounded-pill px-4 py-2.5 text-sm focus:border-forest focus:outline-none"
        />
        <button
          disabled={pending || !draft.trim()}
          onClick={send}
          className="w-10 h-10 rounded-full bg-forest text-white flex items-center justify-center disabled:opacity-40"
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 8L14 2L11 14L7 9L2 8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

type TimelineItem =
  | { kind: 'message'; id: string; at: Date; msg: ChatMessageResponse }
  | { kind: 'offer'; id: string; at: Date; event: OfferEventResponse }
  | { kind: 'inspection'; id: string; at: Date; inspection: InspectionResponse };

function mergeTimeline(
  messages: ChatMessageResponse[],
  offers: OfferEventResponse[],
  inspections: InspectionResponse[],
): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const m of messages) items.push({ kind: 'message', id: m.id, at: new Date(m.createdAt), msg: m });
  for (const o of offers) items.push({ kind: 'offer', id: o.id, at: new Date(o.createdAt), event: o });
  for (const i of inspections)
    items.push({ kind: 'inspection', id: i.id, at: new Date(i.createdAt), inspection: i });
  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return items;
}
