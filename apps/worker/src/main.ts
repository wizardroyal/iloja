import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { handleChainAnchor } from './processors/chain-anchor';
import { handleEscrowTimer } from './processors/escrow-timers';
import { handleInspectionReminder } from './processors/inspection-reminders';
import { handleMaintenance } from './processors/maintenance';
import { handleNotificationDispatch } from './processors/notifications';
import { handlePayoutDispatch } from './processors/payouts';
import { handleSavedSearchAlerts } from './processors/saved-search-alerts';
import { QUEUES, type QueueName } from './queues';

const log = pino({ name: 'iloja-worker' });

function makeConnection(): IORedis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

const processors: Record<QueueName, (jobName: string, data: unknown) => Promise<void>> = {
  [QUEUES.ESCROW_TIMERS]: handleEscrowTimer,
  [QUEUES.CHAIN_ANCHOR]: handleChainAnchor,
  [QUEUES.NOTIFICATIONS]: handleNotificationDispatch,
  [QUEUES.INSPECTION_REMINDERS]: handleInspectionReminder,
  [QUEUES.LISTING_REVERIFICATION]: handleMaintenance,
  [QUEUES.SAVED_SEARCH_ALERTS]: handleSavedSearchAlerts,
  [QUEUES.PAYOUTS]: handlePayoutDispatch,
};

/** Recurring jobs scheduled at boot. BullMQ dedupes by jobId across restarts. */
async function registerRepeatingJobs(connection: IORedis): Promise<Queue[]> {
  const queues: Queue[] = [];
  // Hourly chain anchor batch — drains pending documents, writes hashes
  // to Base L2.
  const anchorQueue = new Queue(QUEUES.CHAIN_ANCHOR, { connection });
  await anchorQueue.add(
    'chain.anchor.batch',
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'chain.anchor.batch.repeat',
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  queues.push(anchorQueue);
  log.info('registered hourly chain.anchor.batch');

  // Hourly saved-search alerts — fans out new-listing notifications.
  const alertsQueue = new Queue(QUEUES.SAVED_SEARCH_ALERTS, { connection });
  await alertsQueue.add(
    'saved_searches.run_alerts',
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'saved_searches.run_alerts.repeat',
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  queues.push(alertsQueue);
  log.info('registered hourly saved_searches.run_alerts');

  // Hourly housekeeping — currently expires past-period subscriptions.
  const maintenanceQueue = new Queue(QUEUES.LISTING_REVERIFICATION, { connection });
  await maintenanceQueue.add(
    'subscriptions.sweep_expired',
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'subscriptions.sweep_expired.repeat',
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  queues.push(maintenanceQueue);
  log.info('registered hourly subscriptions.sweep_expired');
  return queues;
}

async function bootstrap(): Promise<void> {
  const connection = makeConnection();
  const workers: Worker[] = [];

  for (const queueName of Object.values(QUEUES)) {
    const worker = new Worker(
      queueName,
      async (job) => processors[queueName](job.name, job.data),
      { connection },
    );
    worker.on('failed', (job, err) => log.error({ queueName, jobId: job?.id, err }, 'job failed'));
    workers.push(worker);
    log.info({ queueName }, 'worker registered');
  }

  const queues = await registerRepeatingJobs(connection).catch((err) => {
    log.warn({ err }, 'could not register repeating jobs (Redis offline?)');
    return [] as Queue[];
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    log.info({ signal }, 'shutting down');
    await Promise.all([...workers.map((w) => w.close()), ...queues.map((q) => q.close())]);
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void bootstrap();
