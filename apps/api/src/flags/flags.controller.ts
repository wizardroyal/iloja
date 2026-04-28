import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import type { ListingFlag } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CreateFlagDto, CreateFlagSchema, ResolveFlagDto, ResolveFlagSchema } from './flags.dto';
import { FlagsService } from './flags.service';

@Controller('flags')
@UseGuards(CurrentUserGuard)
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateFlagSchema))
  create(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreateFlagDto,
  ): Promise<ListingFlag> {
    return this.flags.create(body.listingId, user.id, body);
  }

  @Get('open')
  list(@CurrentUserParam() user: CurrentUser): Promise<ListingFlag[]> {
    assertHasRole(user, 'admin');
    return this.flags.listOpen();
  }

  @Get('mine')
  mine(@CurrentUserParam() user: CurrentUser): Promise<ListingFlag[]> {
    return this.flags.listMine(user.id);
  }

  @Post(':id/resolve')
  @UsePipes(new ZodValidationPipe(ResolveFlagSchema))
  resolve(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: ResolveFlagDto,
  ): Promise<ListingFlag> {
    assertHasRole(user, 'admin');
    return this.flags.resolve(id, body.valid, body.decisionNotes, user.id);
  }
}
