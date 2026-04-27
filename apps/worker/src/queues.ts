/**
 * Single source of truth for queue names. Producers (API) and consumers
 * (worker) both import from here so a typo can't silently route a job to the
 * void.
 */
export const QUEUES = {
  /** Auto-release / refund timers for funded escrows. */
  ESCROW_TIMERS: 'escrow.timers',
  /** Hourly batch — hash documents and write to Base L2. */
  CHAIN_ANCHOR: 'chain.anchor',
  /** Push, email, SMS fanout. */
  NOTIFICATIONS: 'notifications',
  /** Inspection reminders (24hr / 1hr before). */
  INSPECTION_REMINDERS: 'inspection.reminders',
  /** Periodic re-verification of long-standing listings. */
  LISTING_REVERIFICATION: 'listing.reverification',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
