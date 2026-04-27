import { Inject, Injectable, Logger } from '@nestjs/common';
import { QUEUES } from '@iloja/types';
import type { Notification, NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATIONS_PROVIDER,
  type NotificationsProvider,
} from '../providers/notifications/notifications.provider';
import { QueueProducer } from '../queue/queue.producer';

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
  contextRef?: string | null;
  tx?: Prisma.TransactionClient;
}

/**
 * Notifications are persisted first (in-app inbox is the source of truth),
 * then handed to BullMQ for fan-out to push/email/SMS. Persistence inside
 * the caller's transaction means the notification never goes out for an
 * event that rolled back.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueProducer,
    @Inject(NOTIFICATIONS_PROVIDER) private readonly provider: NotificationsProvider,
  ) {}

  async notify(input: NotifyInput): Promise<Notification> {
    const client = input.tx ?? this.prisma;
    const row = await client.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        contextRef: input.contextRef ?? null,
        channel: 'push',
        status: 'pending',
      },
    });
    // Best-effort enqueue. If Redis is offline (dev) we still hold the
    // row so the in-app inbox surfaces it.
    await this.queue
      .enqueue(QUEUES.NOTIFICATIONS, 'notifications.dispatch', { id: row.id })
      .catch((err) => this.logger.warn(`Could not enqueue ${row.id}: ${(err as Error).message}`));
    return row;
  }

  async listInbox(userId: string, opts: { unreadOnly?: boolean; take?: number } = {}): Promise<
    Notification[]
  > {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 50,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, ids?: string[]): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * Worker entry point. Loads the row, dispatches via the provider, and
   * marks `sent` or `failed` according to the result. Idempotent — already
   * `sent` rows skip.
   */
  async dispatch(notificationId: string): Promise<void> {
    const row = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!row) return;
    if (row.status === 'sent') return;
    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) return;

    const result = await this.provider.dispatch({
      channel: row.channel,
      recipient: { userId: row.userId, phone: user.phone, email: user.email ?? undefined },
      title: row.title,
      body: row.body,
      href: row.href,
      data: row.contextRef ? { contextRef: row.contextRef } : undefined,
    });

    await this.prisma.notification.update({
      where: { id: row.id },
      data: {
        status: result.status === 'sent' ? 'sent' : 'failed',
        sentAt: result.status === 'sent' ? new Date() : null,
      },
    });
  }
}
