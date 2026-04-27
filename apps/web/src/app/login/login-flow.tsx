'use client';

import { ApiError } from '@iloja/sdk';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { writeSession } from '@/lib/session';

type Phase = 'enter_phone' | 'enter_code';

/**
 * Phone OTP login. Two phases:
 * 1. Enter phone → POST /auth/otp/request, dev-only the API logs the code
 * 2. Enter code → POST /auth/otp/verify, store bearer token, redirect home
 *
 * fullName is required for first-time signups; we always ask for it on the
 * verify step rather than try to detect existing users on the request side.
 */
export function LoginFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('enter_phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      await getBrowserClient().requestOtp(phone);
      setPhase('enter_code');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const result = await getBrowserClient().verifyOtp({
        phone,
        code,
        fullName: fullName.trim() || undefined,
      });
      writeSession({ token: result.token, userId: result.userId });
      router.push('/');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="px-5 pt-6 pb-3 flex items-center justify-between flex-shrink-0">
        <span className="font-display text-2xl text-forest tracking-tight">iloja</span>
        {phase === 'enter_code' && (
          <button onClick={() => setPhase('enter_phone')} className="text-grove text-sm font-semibold">
            ← Change number
          </button>
        )}
      </header>

      <div className="flex-1 px-6 py-8 overflow-y-auto">
        {phase === 'enter_phone' ? (
          <>
            <h1 className="font-display text-3xl text-forest mb-2">Sign in</h1>
            <p className="text-sm text-ink-muted mb-8">
              Enter your phone number. We&apos;ll text you a 6-digit code.
            </p>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 block">
                Phone number
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2348012345678"
                inputMode="tel"
                className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-base focus:border-forest focus:outline-none"
              />
            </label>
            <button
              disabled={pending || phone.length < 8}
              onClick={requestOtp}
              className="w-full mt-6 bg-forest text-white rounded-pill py-3.5 font-semibold text-sm disabled:opacity-40"
            >
              {pending ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl text-forest mb-2">Enter the code</h1>
            <p className="text-sm text-ink-muted mb-8">
              Sent to <span className="font-semibold">{phone}</span>. Codes expire in 5 minutes.
            </p>

            <label className="block mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 block">
                6-digit code
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-2xl tracking-[0.5em] text-center font-display focus:border-forest focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 block">
                Your name (first-time only)
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adaeze Okafor"
                className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-base focus:border-forest focus:outline-none"
              />
            </label>

            <button
              disabled={pending || code.length !== 6}
              onClick={verifyOtp}
              className="w-full mt-6 bg-forest text-white rounded-pill py-3.5 font-semibold text-sm disabled:opacity-40"
            >
              {pending ? 'Verifying…' : 'Verify & continue'}
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 text-xs text-danger bg-warning-tint border border-warning rounded-lg p-3">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Code is wrong or expired. Try again.';
    if (err.status === 429) return 'Too many requests. Wait a minute.';
    return `Server returned ${err.status}`;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}
