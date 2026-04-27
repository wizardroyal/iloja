import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { handleEscrowTimer } from './processors/escrow-timers';
import { QUEUES, type QueueName } from './queues';

const log = pino({ name: 'iloja-worker' });

function makeConnection(): IORedis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

const processors: Record<QueueName, (jobName: string, data: unknown) => Promise<void>> = {
  [QUEUES.ESCROW_TIMERS]: handleEscrowTimer,
  [QUEUES.CHAIN_ANCHOR]: async (jobName, data) => {
    log.info({ jobName, data }, 'chain anchor batch (stub — Sprint 5)');
  },
  [QUEUES.NOTIFICATIONS]: async (jobName, data) => {
    log.info({ jobName, data }, 'notification dispatch (stub — Sprint 6)');
  },
  [QUEUES.INSPECTION_REMINDERS]: async (jobName, data) => {
    log.info({ jobName, data }, 'inspection reminder (stub — Sprint 6 fan-out)');
  },
  [QUEUES.LISTING_REVERIFICATION]: async (jobName, data) => {
    log.info({ jobName, data }, 'listing re-verification (stub — Phase 2)');
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
