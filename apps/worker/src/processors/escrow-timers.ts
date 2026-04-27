import pino from 'pino';

const log = pino({ name: 'escrow-timers' });

export interface EscrowAutoReleaseJob {
  escrowId: string;
  kind: 'inspection_fee' | 'short_let_booking' | 'long_term_rent';
}

/**
 * Calls the API's internal auto-release endpoint when the timer fires. The
 * API is responsible for idempotency — we just call once per job and let
 * BullMQ's retry-with-backoff handle transient network failures.
 */
export async function handleEscrowTimer(jobName: string, data: unknown): Promise<void> {
  if (jobName !== 'escrow.auto_release') {
    log.warn({ jobName }, 'unknown escrow timer job');
    return;
  }
  const job = data as EscrowAutoReleaseJob;
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    log.error({ escrowId: job.escrowId }, 'INTERNAL_SECRET unset — cannot release');
    return;
  }
  const res = await fetch(`${apiUrl}/internal/escrow/${job.escrowId}/auto-release`, {
    method: 'POST',
    headers: { 'x-iloja-internal-secret': secret },
  });
  if (!res.ok) {
    const text = await res.text();
    log.error({ escrowId: job.escrowId, status: res.status, body: text }, 'auto-release failed');
    throw new Error(`auto-release ${res.status}`);
  }
  const body = (await res.json()) as { acted: boolean };
  log.info({ escrowId: job.escrowId, acted: body.acted }, 'auto-release ack');
}
