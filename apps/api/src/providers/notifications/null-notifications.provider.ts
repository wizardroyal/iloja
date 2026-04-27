import { Injectable, Logger } from '@nestjs/common';
import type {
  DispatchInput,
  DispatchResult,
  NotificationsProvider,
} from './notifications.provider';

/**
 * Sprint-6 stand-in. Logs the dispatch and reports `sent` so the consumer
 * marks the row delivered. Replace with FcmNotificationsProvider /
 * ResendNotificationsProvider / TermiiNotificationsProvider in the
 * followup pass.
 */
@Injectable()
export class NullNotificationsProvider implements NotificationsProvider {
  private readonly logger = new Logger(NullNotificationsProvider.name);

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    this.logger.warn(
      `NullNotifications [${input.channel}] → ${input.recipient.userId}: ${input.title}`,
    );
    return { status: 'sent', providerRef: `null-${Date.now()}` };
  }
}
