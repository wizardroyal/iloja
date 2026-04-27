import pino from 'pino';

const log = pino({ name: 'notifications' });

export async function handleNotificationDispatch(jobName: string, data: unknown): Promise<void> {
  if (jobName !== 'notifications.dispatch') {
    log.warn({ jobName }, 'unknown notification job');
    return;
  }
  const { id } = data as { id: string };
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    log.error({ id }, 'INTERNAL_SECRET unset — cannot dispatch');
    return;
  }
  const res = await fetch(`${apiUrl}/notifications/internal/dispatch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-iloja-internal-secret': secret,
    },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    log.error({ id, status: res.status }, 'dispatch failed');
    throw new Error(`dispatch ${res.status}`);
  }
}
