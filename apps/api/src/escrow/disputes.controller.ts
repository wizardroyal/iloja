import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import type { Dispute } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DisputeDecisionDto, DisputeDecisionSchema } from './escrow.dto';
import { DisputesService } from './disputes.service';

@Controller('disputes')
@UseGuards(CurrentUserGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@CurrentUserParam() user: CurrentUser): Promise<Dispute[]> {
    assertHasRole(user, 'admin');
    return this.disputes.listOpen();
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUserParam() user: CurrentUser): Promise<Dispute> {
    assertHasRole(user, 'admin');
    return this.disputes.findById(id);
  }

  @Post(':id/decide')
  @UsePipes(new ZodValidationPipe(DisputeDecisionSchema))
  decide(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: DisputeDecisionDto,
  ): Promise<Dispute> {
    assertHasRole(user, 'admin');
    return this.disputes.decide(id, body.inFavorOf, body.decisionNotes, user.id);
  }
}
