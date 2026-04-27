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
import type { OfferEvent } from '@prisma/client';
import { CurrentUser, CurrentUserGuard, CurrentUserParam } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MakeOfferDto, MakeOfferSchema } from './offers.dto';
import { OffersService } from './offers.service';

@Controller('chat/threads/:threadId/offers')
@UseGuards(CurrentUserGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(
    @Param('threadId') threadId: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<OfferEvent[]> {
    return this.offers.list(threadId, user.id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(MakeOfferSchema))
  make(
    @Param('threadId') threadId: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: MakeOfferDto,
  ): Promise<OfferEvent> {
    return this.offers.makeOffer(threadId, user.id, body);
  }

  @Post('accept')
  @HttpCode(200)
  accept(
    @Param('threadId') threadId: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<OfferEvent> {
    return this.offers.accept(threadId, user.id);
  }

  @Post('decline')
  @HttpCode(200)
  decline(
    @Param('threadId') threadId: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<OfferEvent> {
    return this.offers.decline(threadId, user.id);
  }

  @Post('withdraw')
  @HttpCode(200)
  withdraw(
    @Param('threadId') threadId: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<OfferEvent> {
    return this.offers.withdraw(threadId, user.id);
  }
}
