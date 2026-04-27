import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Headers,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Internal endpoint the worker calls when an inspection reminder timer
 * fires. Issues notifications to both parties; idempotent at the
 * notifications layer (recipient sees one row per BullMQ jobId).
 */
@Controller('internal/inspections')
export class InternalInspectionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post(':id/reminder')
  @HttpCode(200)
  async fireReminder(
    @Param('id') id: string,
    @Body() body: { window: '24h' | '1h' },
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<{ ok: true }> {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
    if (body.window !== '24h' && body.window !== '1h') {
      throw new BadRequestException('window must be 24h or 1h');
    }
    const inspection = await this.prisma.inspection.findUnique({ where: { id } });
    if (!inspection) throw new NotFoundException('Inspection not found');
    // Cancelled / completed inspections shouldn't trigger reminders.
    if (inspection.status !== 'confirmed') return { ok: true };

    const friendly = inspection.scheduledAt.toLocaleString('en-NG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const kind = body.window === '24h' ? 'inspection_reminder_24h' : 'inspection_reminder_1h';
    const title = body.window === '24h' ? 'Inspection tomorrow' : 'Inspection in 1 hour';
    for (const userId of [inspection.forUserId, inspection.byUserId]) {
      await this.notifications.notify({
        userId,
        kind,
        title,
        body: friendly,
        href: `/chat/${inspection.threadId}`,
        contextRef: inspection.id,
      });
    }
    return { ok: true };
  }
}
