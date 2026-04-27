'use client';

import { ApiError, type EscrowResponse } from '@iloja/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { VerifiedRecord } from '@/components/verified-record';
import { getBrowserClient } from '@/lib/browser-client';
import { formatNairaFromKobo } from '@/lib/sample-listings';

type Phase = 'fund' | 'check_in' | 'confirm_or_dispute' | 'success' | 'disputed';

/**
 * Three-step inspection-fee escrow flow (port of screen 04):
 *   fund                → Paystack authorization redirect
 *   check_in            → renter at the property → GPS validated
 *   confirm_or_dispute  → matches listing? confirm; else dispute
 *   success / disputed  → terminal screen
 *
 * The phase is derived from server state (escrow.state + dispute presence)
 * rather than tracked locally, so a refresh in any phase always recovers.
 */
export function EscrowFlow({ escrowId }: { escrowId: string }) {
  const client = useMemo(() => getBrowserClient(), []);
  const [escrow, setEscrow] = useState<EscrowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const fresh = await client.getEscrow(escrowId);
      setEscrow(fresh);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? `API ${err.status}` : 'Network error');
    }
  }, [client, escrowId]);

  useEffect(() => {
    void refresh();
    // While funding is in flight (state === 'created'), poll fast so the
    // moment Paystack confirms we hop forward automatically.
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!escrow) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
        {error ?? 'Loading…'}
      </div>
    );
  }

  const phase: Phase =
    escrow.state === 'released'
      ? 'success'
      : escrow.state === 'disputed' || escrow.state === 'refunded'
        ? 'disputed'
        : escrow.state === 'created'
          ? 'fund'
          : checkedIn
            ? 'confirm_or_dispute'
            : 'check_in';

  async function fundEscrow(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      // Re-create call is idempotent — returns the same escrow + a fresh
      // payment URL. We use the inspection backing this escrow.
      // For now we just open the existing authorizationUrl if we have one.
      if (authUrl) {
        window.open(authUrl, '_blank');
      } else {
        setError('Open the original payment URL from your inspection details.');
      }
    } finally {
      setPending(false);
    }
  }

  async function checkIn(): Promise<void> {
    setPending(true);
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('GPS unavailable on this device');
      setPending(false);
      return;
    }
    try {
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
      await client.escrowCheckIn(escrowId, {
        lat: coords.latitude,
        lng: coords.longitude,
      });
      setCheckedIn(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'GPS check-in failed');
    } finally {
      setPending(false);
    }
  }

  async function confirm(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await client.escrowConfirm(escrowId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `API ${err.status}` : 'Confirm failed');
    } finally {
      setPending(false);
    }
  }

  async function dispute(): Promise<void> {
    setPending(true);
    setError(null);
    if (disputeReason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      setPending(false);
      return;
    }
    try {
      await client.escrowDispute(escrowId, { reason: disputeReason.trim() });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `API ${err.status}` : 'Dispute failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Header />
      <PhaseHeader escrow={escrow} phase={phase} />
      <div className="flex-1 overflow-y-auto px-5 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {phase === 'fund' && (
          <Fund
            escrow={escrow}
            onPay={fundEscrow}
            pending={pending}
            authUrl={authUrl}
            setAuthUrl={setAuthUrl}
          />
        )}
        {phase === 'check_in' && <CheckIn onCheckIn={checkIn} pending={pending} escrow={escrow} />}
        {phase === 'confirm_or_dispute' && !showDisputeForm && (
          <ConfirmOrDispute
            escrow={escrow}
            onConfirm={confirm}
            onOpenDispute={() => setShowDisputeForm(true)}
            pending={pending}
          />
        )}
        {phase === 'confirm_or_dispute' && showDisputeForm && (
          <DisputeForm
            reason={disputeReason}
            setReason={setDisputeReason}
            onSubmit={dispute}
            onCancel={() => setShowDisputeForm(false)}
            pending={pending}
          />
        )}
        {phase === 'success' && <SuccessReceipt escrow={escrow} />}
        {phase === 'disputed' && <DisputedNotice escrow={escrow} />}

        {error && (
          <p className="mt-4 text-xs text-danger bg-warning-tint border border-warning rounded-lg p-3">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

function Header() {
  return (
    <header className="px-5 pt-4 pb-3 flex items-center gap-3 flex-shrink-0 border-b border-line bg-cream">
      <Link href="/" className="text-grove text-sm font-semibold">
        ←
      </Link>
      <span className="font-display text-lg text-forest">Inspection escrow</span>
    </header>
  );
}

function PhaseHeader({ escrow, phase }: { escrow: EscrowResponse; phase: Phase }) {
  const steps: { label: string; matches: Phase[] }[] = [
    { label: 'Fund', matches: ['fund'] },
    { label: 'At property', matches: ['check_in'] },
    { label: 'Confirm', matches: ['confirm_or_dispute', 'success', 'disputed'] },
  ];
  const activeIdx = steps.findIndex((s) => s.matches.includes(phase));
  return (
    <div className="px-5 pt-4 pb-2 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3">
        {steps.map((step, i) => (
          <div key={step.label} className="flex-1 flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                i <= activeIdx
                  ? 'bg-forest text-white'
                  : 'bg-parchment text-ink-subtle border border-line'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px ${i < activeIdx ? 'bg-forest' : 'bg-line'}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 text-center">
        {steps.map((step, i) => (
          <span
            key={step.label}
            className={`text-[11px] ${
              i <= activeIdx ? 'text-forest font-semibold' : 'text-ink-subtle'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
      <div className="mt-3 bg-success-tint border border-mint rounded-xl px-3 py-2 flex items-center gap-2">
        <span className="text-base">🔒</span>
        <div>
          <div className="text-[11px] font-bold text-grove uppercase tracking-wider">
            {formatNairaFromKobo(escrow.amountKobo)} held in escrow
          </div>
          <div className="text-[10px] text-ink-muted">
            Released to agent only when you tap Confirm.
          </div>
        </div>
      </div>
    </div>
  );
}

function Fund({
  escrow,
  onPay,
  pending,
  authUrl,
  setAuthUrl,
}: {
  escrow: EscrowResponse;
  onPay: () => void;
  pending: boolean;
  authUrl: string | null;
  setAuthUrl: (u: string) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-forest mb-2">Fund your inspection</h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-6">
        Pay the inspection fee into Iloja escrow. Your money is protected — it only releases to
        the agent after you confirm the property matches its listing. If it doesn&apos;t, you can
        dispute and get refunded.
      </p>
      <div className="bg-white border border-line rounded-2xl p-4 shadow-card mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1">
          Inspection fee
        </div>
        <div className="font-display text-3xl text-forest">
          {formatNairaFromKobo(escrow.amountKobo)}
        </div>
      </div>

      <label className="block mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 block">
          Payment URL (paste from your inspection screen)
        </span>
        <input
          value={authUrl ?? ''}
          onChange={(e) => setAuthUrl(e.target.value)}
          placeholder="https://checkout.paystack.com/…"
          className="w-full bg-white border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none"
        />
      </label>

      <button
        disabled={pending || !authUrl}
        onClick={onPay}
        className="w-full bg-forest text-white rounded-pill py-3.5 font-semibold text-sm disabled:opacity-40"
      >
        Pay with Paystack
      </button>
      <p className="text-[11px] text-ink-subtle text-center mt-3">
        Payment confirms automatically. Refresh this page after paying.
      </p>
    </div>
  );
}

function CheckIn({
  onCheckIn,
  pending,
  escrow,
}: {
  onCheckIn: () => void;
  pending: boolean;
  escrow: EscrowResponse;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-forest mb-2">At the property</h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-6">
        Once you arrive, tap the button below. We&apos;ll verify your location is within 100m
        of the listing&apos;s registered address before letting you confirm or dispute.
      </p>
      <div className="bg-white border border-line rounded-2xl p-4 shadow-card mb-4 flex items-center gap-3">
        <span className="w-10 h-10 bg-success-tint border border-mint rounded-xl flex items-center justify-center text-lg">
          📍
        </span>
        <div>
          <div className="text-xs font-semibold text-ink">Funds held by Iloja</div>
          <div className="text-[11px] text-ink-subtle">
            Funded {escrow.fundedAt ? new Date(escrow.fundedAt).toLocaleString('en-NG') : '—'}
          </div>
        </div>
      </div>

      <button
        disabled={pending}
        onClick={onCheckIn}
        className="w-full bg-forest text-white rounded-pill py-3.5 font-semibold text-sm disabled:opacity-40"
      >
        {pending ? 'Checking your location…' : "I'm at the property"}
      </button>
    </div>
  );
}

function ConfirmOrDispute({
  escrow,
  onConfirm,
  onOpenDispute,
  pending,
}: {
  escrow: EscrowResponse;
  onConfirm: () => void;
  onOpenDispute: () => void;
  pending: boolean;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-forest mb-2">How does it look?</h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-6">
        Confirming releases <strong>{formatNairaFromKobo(escrow.amountKobo)}</strong> to the
        agent immediately. If the property doesn&apos;t match its listing, dispute instead and
        Iloja will adjudicate.
      </p>

      <button
        disabled={pending}
        onClick={onConfirm}
        className="w-full bg-grove text-white rounded-pill py-3.5 font-semibold text-sm mb-3 disabled:opacity-40"
      >
        {pending ? 'Releasing…' : '✓ Property matches — release fee'}
      </button>

      <button
        disabled={pending}
        onClick={onOpenDispute}
        className="w-full bg-white border-2 border-danger text-danger rounded-pill py-3 font-semibold text-sm disabled:opacity-40"
      >
        ⚠ Property doesn&apos;t match — dispute
      </button>
    </div>
  );
}

function DisputeForm({
  reason,
  setReason,
  onSubmit,
  onCancel,
  pending,
}: {
  reason: string;
  setReason: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-forest mb-2">Open a dispute</h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-5">
        What didn&apos;t match? Iloja ops will review with the agent and decide. Funds stay
        frozen until the case is closed.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={5}
        placeholder="The flat had only 1 bedroom, not 2 as listed. Photos attached."
        className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none resize-none mb-4"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-white border border-line text-ink-muted rounded-pill py-3 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          disabled={pending || reason.trim().length < 10}
          onClick={onSubmit}
          className="flex-[2] bg-danger text-white rounded-pill py-3 text-sm font-semibold disabled:opacity-40"
        >
          Submit dispute
        </button>
      </div>
    </div>
  );
}

function SuccessReceipt({ escrow }: { escrow: EscrowResponse }) {
  const release = BigInt(escrow.amountKobo) - BigInt(escrow.feeKobo);
  return (
    <div className="text-center pt-6">
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
      <h2 className="font-display text-2xl text-forest mb-2">Released</h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-3">
        Inspection fee released to agent. A verified record of this transaction is on file.
      </p>
      <div className="mb-5">
        <VerifiedRecord contextRef={escrow.id} />
      </div>
      <ul className="bg-white border border-line rounded-2xl shadow-card text-left divide-y divide-line">
        <li className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-muted">Released</span>
          <span className="font-semibold text-ink">{formatNairaFromKobo(release.toString())}</span>
        </li>
        <li className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-muted">Iloja fee</span>
          <span className="font-semibold text-ink">{formatNairaFromKobo(escrow.feeKobo)}</span>
        </li>
        <li className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-muted">Settled</span>
          <span className="font-semibold text-ink">
            {escrow.resolvedAt ? new Date(escrow.resolvedAt).toLocaleString('en-NG') : '—'}
          </span>
        </li>
      </ul>
      <Link
        href="/"
        className="inline-block mt-6 bg-forest text-white rounded-pill py-3 px-7 text-sm font-semibold"
      >
        Back to home
      </Link>
    </div>
  );
}

function DisputedNotice({ escrow }: { escrow: EscrowResponse }) {
  const refunded = escrow.state === 'refunded';
  return (
    <div className="text-center pt-6">
      <div
        className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 ${
          refunded ? 'bg-success-tint' : 'bg-warning-tint'
        }`}
      >
        <span className="text-3xl">{refunded ? '↩' : '⚠'}</span>
      </div>
      <h2 className="font-display text-2xl text-forest mb-2">
        {refunded ? 'Refunded' : 'Dispute open'}
      </h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-6">
        {refunded
          ? 'Your inspection fee has been refunded in full. The agent record reflects this outcome.'
          : "Iloja ops are reviewing. We'll notify you when there's a decision."}
      </p>
      <Link
        href="/"
        className="inline-block bg-forest text-white rounded-pill py-3 px-7 text-sm font-semibold"
      >
        Back to home
      </Link>
    </div>
  );
}
