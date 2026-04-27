import pino from 'pino';
import { INSPECTION_REMINDER_JOBS, type InspectionReminderPayload } from '../queues';

const log = pino({ name: 'inspection-reminders' });

export async function handleInspectionReminder(jobName: string, data: unknown): Promise<void> {
  const payload = data as InspectionReminderPayload;
  let window: '24h' | '1h';
  switch (jobName) {
    case INSPECTION_REMINDER_JOBS.T_MINUS_24H:
      window = '24h';
      break;
    case INSPECTION_REMINDER_JOBS.T_MINUS_1H:
      window = '1h';
      break;
    default:
      log.warn({ jobName }, 'unknown reminder job');
      return;
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    log.error({ inspectionId: payload.inspectionId }, 'INTERNAL_SECRET unset');
    return;
  }
  const res = await fetch(
    `${apiUrl}/internal/inspections/${payload.inspectionId}/reminder`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-iloja-internal-secret': secret,
      },
      body: JSON.stringify({ window }),
    },
  );
  if (!res.ok) {
    log.error(
      { inspectionId: payload.inspectionId, window, status: res.status },
      'reminder dispatch failed',
    );
    throw new Error(`reminder ${res.status}`);
  }
}
