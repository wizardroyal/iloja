import type { Notification } from '@prisma/client';
import { NotificationsService } from './notifications.service';

function makeFakePrisma() {
  const rows: Notification[] = [];
  let id = 1;
  return {
    rows,
    notification: {
      create: async ({ data }: { data: Omit<Notification, 'id' | 'createdAt' | 'readAt' | 'sentAt'> }) => {
        const row: Notification = {
          ...data,
          id: `n${id++}`,
          createdAt: new Date(),
          readAt: null,
          sentAt: null,
        } as Notification;
        rows.unshift(row);
        return row;
      },
      findMany: async ({ where }: { where: { userId: string; readAt?: null | undefined } }) =>
        rows.filter(
          (r) =>
            r.userId === where.userId &&
            (where.readAt === undefined || r.readAt === null),
        ),
      count: async ({ where }: { where: { userId: string; readAt: null } }) =>
        rows.filter((r) => r.userId === where.userId && r.readAt === null).length,
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string; readAt: null; id?: { in: string[] } };
        data: { readAt: Date };
      }) => {
        let n = 0;
        for (const r of rows) {
          if (r.userId !== where.userId || r.readAt !== null) continue;
          if (where.id && !where.id.in.includes(r.id)) continue;
          r.readAt = data.readAt;
          n += 1;
        }
        return { count: n };
      },
    },
  };
}

const queue = { enqueue: jest.fn(async () => undefined) };
const provider = { dispatch: jest.fn(async () => ({ status: 'sent' as const })) };

describe('NotificationsService', () => {
  it('persists a notification and enqueues fan-out', async () => {
    const prisma = makeFakePrisma();
    const svc = new NotificationsService(prisma as never, queue as never, provider as never);
    const row = await svc.notify({
      userId: 'u1',
      kind: 'message_new',
      title: 'New message',
      body: 'Hello',
      href: '/chat/1',
    });
    expect(row.id).toBe('n1');
    expect(prisma.rows).toHaveLength(1);
    expect(queue.enqueue).toHaveBeenCalled();
  });

  it('reports unread count and clears via markRead', async () => {
    const prisma = makeFakePrisma();
    const svc = new NotificationsService(prisma as never, queue as never, provider as never);
    await svc.notify({ userId: 'u1', kind: 'message_new', title: 'A', body: 'a' });
    await svc.notify({ userId: 'u1', kind: 'offer_made', title: 'B', body: 'b' });
    expect(await svc.unreadCount('u1')).toBe(2);
    const result = await svc.markRead('u1');
    expect(result.updated).toBe(2);
    expect(await svc.unreadCount('u1')).toBe(0);
  });
});
