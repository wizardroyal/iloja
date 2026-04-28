'use client';

import { ApiError, type PayoutResponse, type UserBankAccountResponse } from '@iloja/sdk';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { formatNairaFromKobo } from '@/lib/sample-listings';
import { readSession } from '@/lib/session';

/**
 * Common Nigerian bank short-codes. Real Paystack bank list is fetched
 * from a "list banks" API at runtime in production; this static set keeps
 * the dev UX honest without a network call.
 */
const NIGERIAN_BANKS: { code: string; name: string }[] = [
  { code: '044', name: 'Access Bank' },
  { code: '058', name: 'GTBank' },
  { code: '011', name: 'First Bank' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '057', name: 'Zenith Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '050', name: 'Ecobank' },
  { code: '221', name: 'Stanbic IBTC' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '999', name: 'Opay (test)' },
];

const PAYOUT_KIND_LABEL: Record<PayoutResponse['kind'], string> = {
  operator_verification: 'Verification fee',
  agent_escrow_release: 'Escrow release',
  landlord_escrow_release: 'Landlord payout',
  refund: 'Refund',
};

const STATUS_TONE: Record<PayoutResponse['status'], string> = {
  queued: 'bg-warning-tint text-warning-deep border-warning/40',
  succeeded: 'bg-success-tint text-grove border-mint',
  failed: 'bg-danger/10 text-danger border-danger/30',
  reversed: 'bg-parchment text-ink-muted border-line',
};

export function BankAccountForm() {
  const router = useRouter();
  const [existing, setExisting] = useState<UserBankAccountResponse | null | undefined>(undefined);
  const [payouts, setPayouts] = useState<PayoutResponse[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!readSession()) {
      router.replace('/login?next=/settings/bank-account');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [bank, history] = await Promise.all([
          getBrowserClient().getMyBankAccount(),
          getBrowserClient().listMyPayouts(),
        ]);
        if (cancelled) return;
        setExisting(bank);
        if (bank) {
          setBankCode(bank.bankCode);
          setAccountNumber(bank.accountNumber);
          setAccountName(bank.accountName);
        }
        setPayouts(history);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? `API ${err.status}` : 'Network error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function save(): Promise<void> {
    setError(null);
    setSaved(false);
    if (!bankCode || !/^[0-9]{6,20}$/.test(accountNumber) || !accountName.trim()) {
      setError('Bank, account number, and account name are all required.');
      return;
    }
    setPending(true);
    try {
      const updated = await getBrowserClient().setMyBankAccount({
        bankCode,
        accountNumber,
        accountName: accountName.trim(),
      });
      setExisting(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? `Save failed (${err.status})` : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  if (existing === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
        {error ?? 'Loading…'}
      </div>
    );
  }

  return (
    <>
      <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-line bg-cream">
        <Link href="/" className="text-grove text-sm font-semibold">
          ←
        </Link>
        <span className="font-display text-lg text-forest">Payout account</span>
        <span className="w-6" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p className="text-sm text-ink-muted mb-5">
          Where Iloja sends your payouts — verification fees, escrow releases, refunds. We
          never see card numbers; only routing details Paystack needs to transfer to you.
        </p>

        <div className="space-y-4 mb-6">
          <Field label="Bank">
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
            >
              <option value="">Choose your bank</option>
              {NIGERIAN_BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Account number">
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              maxLength={20}
              placeholder="0123456789"
              className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
            />
          </Field>

          <Field label="Account name (as it appears at the bank)">
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Full registered name"
              className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-sm focus:border-forest focus:outline-none"
            />
            <p className="text-[11px] text-ink-subtle mt-1">
              Must match exactly — Paystack will reject mismatches.
            </p>
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}
          {saved && (
            <p className="text-xs text-grove bg-success-tint border border-mint rounded-lg p-2.5">
              Saved. Pending payouts will dispatch on the next worker run.
            </p>
          )}

          <button
            disabled={pending}
            onClick={save}
            className="w-full bg-forest text-white rounded-pill py-3 font-semibold text-sm disabled:opacity-40"
          >
            {pending ? 'Saving…' : existing ? 'Update account' : 'Save account'}
          </button>
        </div>

        <h2 className="font-display text-base text-forest mb-2.5">Recent payouts</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-ink-subtle">
            Nothing yet. Approved verifications and confirmed escrows will land here.
          </p>
        ) : (
          <ul className="space-y-2">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="bg-white border border-line rounded-2xl p-3.5 shadow-card"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-ink">
                    {PAYOUT_KIND_LABEL[p.kind]}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill border ${STATUS_TONE[p.status]}`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="font-display text-base text-forest">
                  {formatNairaFromKobo(p.amountKobo)}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">
                  {new Date(p.createdAt).toLocaleString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {p.failureReason && (
                    <span className="text-danger"> · {p.failureReason}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
