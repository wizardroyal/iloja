/**
 * Queue names shared between the API (producers) and the worker (consumers).
 * Sole source of truth — a typo here is a routed-to-the-void job.
 */
export const QUEUES = {
  ESCROW_TIMERS: 'escrow.timers',
  CHAIN_ANCHOR: 'chain.anchor',
  NOTIFICATIONS: 'notifications',
  INSPECTION_REMINDERS: 'inspection.reminders',
  LISTING_REVERIFICATION: 'listing.reverification',
  SAVED_SEARCH_ALERTS: 'saved_searches.alerts',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Job names within INSPECTION_REMINDERS. */
export const INSPECTION_REMINDER_JOBS = {
  T_MINUS_24H: 'inspection.reminder.24h',
  T_MINUS_1H: 'inspection.reminder.1h',
} as const;

export interface InspectionReminderPayload {
  inspectionId: string;
  scheduledAt: string;
  forUserId: string;
  byUserId: string;
}
