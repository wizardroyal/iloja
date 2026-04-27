import pino from 'pino';

const log = pino({ name: 'chain-anchor' });

/**
 * Hourly batch — drain `pending` documents and ask the API to anchor them.
 * Triggered by a recurring BullMQ job (added at boot, see main.ts).
 *
 * The actual chain interaction stays on the API tier so the relayer key
 * and RPC config live in one process; the worker just reads the queue.
 */
export async function handleChainAnchor(jobName: string, _data: unknown): Promise<void> {
  if (jobName !== 'chain.anchor.batch') {
    log.warn({ jobName }, 'unknown chain-anchor job');
    return;
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    log.error('INTERNAL_SECRET unset — cannot anchor');
    return;
  }
  const headers = { 'x-iloja-internal-secret': secret };

  const pendingRes = await fetch(`${apiUrl}/internal/documents/pending?limit=200`, { headers });
  if (!pendingRes.ok) {
    log.error({ status: pendingRes.status }, 'pending fetch failed');
    throw new Error(`pending ${pendingRes.status}`);
  }
  const pending = (await pendingRes.json()) as { id: string }[];
  if (pending.length === 0) {
    log.debug('no pending documents');
    return;
  }
  log.info({ count: pending.length }, 'anchoring batch');

  const anchorRes = await fetch(`${apiUrl}/internal/documents/anchor-batch`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ ids: pending.map((p) => p.id) }),
  });
  if (!anchorRes.ok) {
    log.error({ status: anchorRes.status }, 'anchor-batch failed');
    throw new Error(`anchor-batch ${anchorRes.status}`);
  }
  const result = (await anchorRes.json()) as { anchored: number; failed: number };
  log.info(result, 'batch complete');
}
