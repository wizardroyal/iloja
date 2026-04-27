import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ChatMessage, Thread } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Idempotent: opens (or returns the existing) thread between a renter and
   * the listing owner. Off-platform messaging carries no Iloja protection
   * per the doc, so this is the only correct way to start a conversation.
   */
  async openThread(listingId: string, renterId: string): Promise<Thread> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId === renterId) {
      throw new ForbiddenException('cannot open a thread on your own listing');
    }
    return this.prisma.thread.upsert({
      where: {
        listingId_renterId_agentId: {
          listingId,
          renterId,
          agentId: listing.ownerId,
        },
      },
      update: {},
      create: {
        listingId,
        renterId,
        agentId: listing.ownerId,
      },
    });
  }

  async getThread(id: string, userId: string): Promise<Thread> {
    const thread = await this.prisma.thread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException(`Thread ${id} not found`);
    this.assertParticipant(thread, userId);
    return thread;
  }

  async listMyThreads(userId: string): Promise<Thread[]> {
    return this.prisma.thread.findMany({
      where: { OR: [{ renterId: userId }, { agentId: userId }] },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async listMessages(threadId: string, userId: string): Promise<ChatMessage[]> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    this.assertParticipant(thread, userId);
    return this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(threadId: string, userId: string, body: string): Promise<ChatMessage> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    this.assertParticipant(thread, userId);
    const message = await this.prisma.$transaction(async (tx) => {
      await tx.thread.update({
        where: { id: threadId },
        data: { lastActiveAt: new Date() },
      });
      const created = await tx.chatMessage.create({
        data: { threadId, byUserId: userId, body },
      });
      const recipientId = thread.renterId === userId ? thread.agentId : thread.renterId;
      await this.notifications.notify({
        userId: recipientId,
        kind: 'message_new',
        title: 'New message',
        body: body.slice(0, 120),
        href: `/chat/${threadId}`,
        contextRef: threadId,
        tx,
      });
      return created;
    });
    return message;
  }

  /** Mark every message in this thread that wasn't sent by `userId` as read. */
  async markRead(threadId: string, userId: string): Promise<{ updated: number }> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    this.assertParticipant(thread, userId);
    const result = await this.prisma.chatMessage.updateMany({
      where: { threadId, byUserId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private assertParticipant(thread: Thread, userId: string): void {
    if (thread.renterId !== userId && thread.agentId !== userId) {
      throw new ForbiddenException('not a participant in this thread');
    }
  }
}
