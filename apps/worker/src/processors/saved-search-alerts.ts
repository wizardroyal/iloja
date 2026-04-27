import pino from 'pino';

const log = pino({ name: 'saved-search-alerts' });

/**
 * Hourly cron — calls the API to fan out new-listing notifications for
 * every saved search whose criteria match an active listing newer than
 * the search's lastAlertedAt watermark.
 */
export async function handleSavedSearchAlerts(jobName: string, _data: unknown): Promise<void> {
  if (jobName !== 'saved_searches.run_alerts') {
    log.warn({ jobName }, 'unknown saved-search alert job');
    return;
  }
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    log.error('INTERNAL_SECRET unset');
    return;
  }
  const res = await fetch(`${apiUrl}/internal/saved-searches/run-alerts`, {
    method: 'POST',
    headers: { 'x-iloja-internal-secret': secret },
  });
  if (!res.ok) {
    log.error({ status: res.status }, 'run-alerts failed');
    throw new Error(`run-alerts ${res.status}`);
  }
  const body = (await res.json()) as { alerts: number; searches: number };
  log.info(body, 'saved-search alert batch complete');
}
