/**
 * Outbound notifications. Real implementations wrap FCM (push), Resend
 * (email) and Termii (SMS). We model them as one provider with a `channel`
 * dispatcher so the consumer side stays trivial.
 */
export interface NotificationsProvider {
  dispatch(input: DispatchInput): Promise<DispatchResult>;
}

export interface DispatchInput {
  channel: 'push' | 'email' | 'sms' | 'inapp';
  recipient: { userId: string; phone?: string; email?: string; pushToken?: string };
  title: string;
  body: string;
  href?: string | null;
  /** Free-form payload metadata (threadId, escrowId, etc) for deep-linking. */
  data?: Record<string, string>;
}

export type DispatchResult =
  | { status: 'sent'; providerRef?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

export const NOTIFICATIONS_PROVIDER = Symbol('NOTIFICATIONS_PROVIDER');
