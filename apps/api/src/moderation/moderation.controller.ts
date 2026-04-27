import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import type { UserRestriction } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RestrictUserDto, RestrictUserSchema } from './moderation.dto';
import { ModerationService } from './moderation.service';

@Controller('moderation/restrictions')
@UseGuards(CurrentUserGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  active(@CurrentUserParam() user: CurrentUser): Promise<UserRestriction[]> {
    assertHasRole(user, 'admin');
    return this.moderation.listActive();
  }

  @Get('user/:userId')
  forUser(
    @Param('userId') userId: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<UserRestriction[]> {
    assertHasRole(user, 'admin');
    return this.moderation.listForUser(userId);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(RestrictUserSchema))
  create(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: RestrictUserDto,
  ): Promise<UserRestriction> {
    assertHasRole(user, 'admin');
    return this.moderation.restrict({ ...body, issuedById: user.id });
  }

  @Post(':id/lift')
  lift(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<UserRestriction> {
    assertHasRole(user, 'admin');
    return this.moderation.lift(id, user.id);
  }
}
