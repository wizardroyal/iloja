/**
 * Re-exports the canonical queue names from the shared types package. Kept
 * here so worker source can import from a relative path; the API does the
 * same via @iloja/types.
 */
export { INSPECTION_REMINDER_JOBS, QUEUES, type QueueName } from '@iloja/types';
export type { InspectionReminderPayload } from '@iloja/types';
