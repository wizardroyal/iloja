import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { ChatMessage, Thread } from '@prisma/client';
import { CurrentUser, CurrentUserGuard, CurrentUserParam } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  OpenThreadDto,
  OpenThreadSchema,
  SendMessageDto,
  SendMessageSchema,
} from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(CurrentUserGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('threads')
  @UsePipes(new ZodValidationPipe(OpenThreadSchema))
  open(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: OpenThreadDto,
  ): Promise<Thread> {
    return this.chat.openThread(body.listingId, user.id);
  }

  @Get('threads')
  list(@CurrentUserParam() user: CurrentUser): Promise<Thread[]> {
    return this.chat.listMyThreads(user.id);
  }

  @Get('threads/:id')
  get(@Param('id') id: string, @CurrentUserParam() user: CurrentUser): Promise<Thread> {
    return this.chat.getThread(id, user.id);
  }

  @Get('threads/:id/messages')
  messages(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<ChatMessage[]> {
    return this.chat.listMessages(id, user.id);
  }

  @Post('threads/:id/messages')
  @UsePipes(new ZodValidationPipe(SendMessageSchema))
  send(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: SendMessageDto,
  ): Promise<ChatMessage> {
    return this.chat.sendMessage(id, user.id, body.body);
  }

  @Post('threads/:id/read')
  @HttpCode(200)
  markRead(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<{ updated: number }> {
    return this.chat.markRead(id, user.id);
  }
}
