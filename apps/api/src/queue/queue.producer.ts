import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { QUEUES, type QueueName } from '@iloja/types';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/**
 * BullMQ producer used by services that need to enqueue background work
 * (escrow timers, inspection reminders, chain anchoring batches…). Workers
 * live in apps/worker.
 *
 * If REDIS_URL is unset we fall through to a no-op so dev environments
 * without Redis still boot — the missed jobs are logged.
 */
@Injectable()
export class QueueProducer implements OnModuleDestroy {
  private readonly logger = new Logger(QueueProducer.name);
  private readonly connection: IORedis | null;
  private readonly queues = new Map<QueueName, Queue>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.connection = null;
      this.logger.warn('REDIS_URL not set — queue jobs will be no-ops');
      return;
    }
    this.connection = new IORedis(url, { maxRetriesPerRequest: null });
  }

  async enqueue<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    opts: { delayMs?: number; jobId?: string } = {},
  ): Promise<void> {
    if (!this.connection) {
      this.logger.warn(`enqueue [no-op] ${queueName}/${jobName}`);
      return;
    }
    let q = this.queues.get(queueName);
    if (!q) {
      q = new Queue(queueName, { connection: this.connection });
      this.queues.set(queueName, q);
    }
    await q.add(jobName, data, {
      delay: opts.delayMs,
      jobId: opts.jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    this.logger.log(`enqueued ${queueName}/${jobName} delay=${opts.delayMs ?? 0}ms`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    if (this.connection) await this.connection.quit();
  }

  // Re-export the queue catalog for typed call sites.
  static readonly Q = QUEUES;
}
