import pino from 'pino';

const log = pino({ name: 'payouts' });

export async function handlePayoutDispatch(jobName: string, data: unknown): Promise<void> {
  if (jobName !== 'payouts.dispatch') {
    log.warn({ jobName }, 'unknown payout job');
    return;
  }
  const { id } = data as { id: string };
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    log.error({ id }, 'INTERNAL_SECRET unset');
    return;
  }
  const res = await fetch(`${apiUrl}/payouts/internal/dispatch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-iloja-internal-secret': secret,
    },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    log.error({ id, status: res.status }, 'payout dispatch failed');
    throw new Error(`payout dispatch ${res.status}`);
  }
}
