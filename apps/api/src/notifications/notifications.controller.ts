import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { CurrentUser, CurrentUserGuard, CurrentUserParam } from '../auth/current-user';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @UseGuards(CurrentUserGuard)
  list(
    @CurrentUserParam() user: CurrentUser,
    @Query('unread') unread?: string,
  ): Promise<Notification[]> {
    return this.notifications.listInbox(user.id, { unreadOnly: unread === 'true' });
  }

  @Get('count')
  @UseGuards(CurrentUserGuard)
  async count(@CurrentUserParam() user: CurrentUser): Promise<{ unread: number }> {
    const unread = await this.notifications.unreadCount(user.id);
    return { unread };
  }

  @Post('read')
  @HttpCode(200)
  @UseGuards(CurrentUserGuard)
  markRead(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: { ids?: string[] },
  ): Promise<{ updated: number }> {
    return this.notifications.markRead(user.id, body.ids);
  }

  /**
   * Internal endpoint the worker hits to dispatch a queued notification.
   * Same shared-secret guard pattern as the rest of /internal/*.
   */
  @Post('internal/dispatch')
  @HttpCode(200)
  async dispatch(
    @Body() body: { id: string },
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<{ ok: true }> {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
    await this.notifications.dispatch(body.id);
    return { ok: true };
  }
}
