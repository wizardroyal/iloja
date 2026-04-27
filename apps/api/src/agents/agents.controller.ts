import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserGuard, CurrentUserParam, assertHasRole } from '../auth/current-user';
import {
  AgentsService,
  type AgentDashboardPayload,
  type AgentProfilePayload,
} from './agents.service';

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
}
