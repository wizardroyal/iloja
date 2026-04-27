import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { QUEUES, type QueueName } from './queues';

const log = pino({ name: 'iloja-worker' });

function makeConnection(): IORedis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

/**
 * Stub processors. Each will move into its own file once we have real work to
 * do. For Sprint 0 they exist so the worker boots and the queue contract is
 * visible.
 */
const processors: Record<QueueName, (jobName: string, data: unknown) => Promise<void>> = {
  [QUEUES.ESCROW_TIMERS]: async (jobName, data) => {
    log.info({ jobName, data }, 'escrow timer fired (stub)');
  },
  [QUEUES.CHAIN_ANCHOR]: async (jobName, data) => {
    log.info({ jobName, data }, 'chain anchor batch (stub)');
  },
  [QUEUES.NOTIFICATIONS]: async (jobName, data) => {
    log.info({ jobName, data }, 'notification dispatch (stub)');
  },
  [QUEUES.INSPECTION_REMINDERS]: async (jobName, data) => {
    log.info({ jobName, data }, 'inspection reminder (stub)');
  },
  [QUEUES.LISTING_REVERIFICATION]: async (jobName, data) => {
    log.info({ jobName, data }, 'listing re-verification (stub)');
  },
};

function bootstrap(): void {
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

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    log.info({ signal }, 'shutting down');
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
