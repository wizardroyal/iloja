import pino from 'pino';

const log = pino({ name: 'maintenance' });

/**
 * Hourly housekeeping cron — currently sweeps expired subscriptions.
 * Lives on the LISTING_REVERIFICATION queue because that queue is also
 * hourly housekeeping in the doc's terms; future maintenance jobs (eg.
 * stale-draft cleanup, OTP-challenge purge) join here.
 */
export async function handleMaintenance(jobName: string, _data: unknown): Promise<void> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    log.error('INTERNAL_SECRET unset');
    return;
  }

  if (jobName === 'subscriptions.sweep_expired') {
    const res = await fetch(`${apiUrl}/internal/subscriptions/sweep-expired`, {
      method: 'POST',
      headers: { 'x-iloja-internal-secret': secret },
    });
    if (!res.ok) {
      log.error({ status: res.status }, 'subscriptions sweep failed');
      throw new Error(`sweep ${res.status}`);
    }
    const body = (await res.json()) as { expired: number };
    log.info(body, 'subscriptions sweep complete');
    return;
  }

  log.warn({ jobName }, 'unknown maintenance job');
}
