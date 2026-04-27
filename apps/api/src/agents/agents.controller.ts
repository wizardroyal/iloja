import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import type { AgentProfile } from '@prisma/client';
import { z } from 'zod';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  AgentsService,
  type AgentDashboardPayload,
  type AgentProfilePayload,
} from './agents.service';

const AwardFoundingSchema = z.object({ zone: z.string().min(2).max(80) }).strict();

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get('me/dashboard')
  @UseGuards(CurrentUserGuard)
  dashboard(@CurrentUserParam() user: CurrentUser): Promise<AgentDashboardPayload> {
    assertHasRole(user, 'agent', 'landlord');
    return this.agents.getDashboard(user.id);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AgentProfilePayload> {
    return this.agents.getProfile(id);
  }

  @Post(':id/founding')
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(AwardFoundingSchema))
  awardFounding(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: { zone: string },
  ): Promise<AgentProfile> {
    assertHasRole(user, 'admin');
    return this.agents.awardFoundingAgent(id, body.zone, user.id);
  }
}
