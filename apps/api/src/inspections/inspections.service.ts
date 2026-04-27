import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  INSPECTION_REMINDER_JOBS,
  QUEUES,
  type InspectionReminderPayload,
} from '@iloja/types';
import type { Inspection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueProducer } from '../queue/queue.producer';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

@Injectable()
export class InspectionsService {
  private readonly logger = new Logger(InspectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueProducer,
  ) {}

  /**
   * Renter proposes a slot from inside a chat thread. Once the agent confirms,
   * we schedule the T-24h and T-1h reminder jobs (idempotent — keyed off the
   * inspection ID).
   */
  async propose(threadId: string, userId: string, scheduledAt: string): Promise<Inspection> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    if (thread.renterId !== userId && thread.agentId !== userId) {
      throw new ForbiddenException('not a participant');
    }
    const at = new Date(scheduledAt);
    if (at.getTime() < Date.now() + ONE_HOUR_MS) {
      throw new BadRequestException('inspections must be at least 1 hour in the future');
    }
    return this.prisma.inspection.create({
      data: {
        threadId,
        listingId: thread.listingId,
        forUserId: thread.renterId,
        byUserId: thread.agentId,
        scheduledAt: at,
        status: 'proposed',
      },
    });
  }

  async confirm(id: string, userId: string): Promise<Inspection> {
    const inspection = await this.prisma.inspection.findUnique({ where: { id } });
    if (!inspection) throw new NotFoundException(`Inspection ${id} not found`);
    // Only the agent (the side running the inspection) confirms.
    if (inspection.byUserId !== userId) {
      throw new ForbiddenException('only the agent can confirm');
    }
    if (inspection.status !== 'proposed') {
      throw new BadRequestException(`inspection is ${inspection.status}`);
    }
    const updated = await this.prisma.inspection.update({
      where: { id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    await this.scheduleReminders(updated);
    return updated;
  }

  async cancel(id: string, userId: string): Promise<Inspection> {
    const inspection = await this.prisma.inspection.findUnique({ where: { id } });
    if (!inspection) throw new NotFoundException(`Inspection ${id} not found`);
    if (inspection.byUserId !== userId && inspection.forUserId !== userId) {
      throw new ForbiddenException('not your inspection');
    }
    if (inspection.status === 'completed' || inspection.status === 'no_show') {
      throw new BadRequestException(`cannot cancel a ${inspection.status} inspection`);
    }
    return this.prisma.inspection.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async listForThread(threadId: string, userId: string): Promise<Inspection[]> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    if (thread.renterId !== userId && thread.agentId !== userId) {
      throw new ForbiddenException('not a participant');
    }
    return this.prisma.inspection.findMany({
      where: { threadId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  private async scheduleReminders(inspection: Inspection): Promise<void> {
    const ts = inspection.scheduledAt.getTime();
    const now = Date.now();
    const t24h = ts - now - ONE_DAY_MS;
    const t1h = ts - now - ONE_HOUR_MS;
    const payload: InspectionReminderPayload = {
      inspectionId: inspection.id,
      scheduledAt: inspection.scheduledAt.toISOString(),
      forUserId: inspection.forUserId,
      byUserId: inspection.byUserId,
    };

    if (t24h > 0) {
      await this.queue.enqueue(
        QUEUES.INSPECTION_REMINDERS,
        INSPECTION_REMINDER_JOBS.T_MINUS_24H,
        payload,
        { delayMs: t24h, jobId: `${inspection.id}:24h` },
      );
    } else {
      this.logger.log(`Skipping 24h reminder for ${inspection.id} — too close`);
    }
    if (t1h > 0) {
      await this.queue.enqueue(
        QUEUES.INSPECTION_REMINDERS,
        INSPECTION_REMINDER_JOBS.T_MINUS_1H,
        payload,
        { delayMs: t1h, jobId: `${inspection.id}:1h` },
      );
    }
  }
}
