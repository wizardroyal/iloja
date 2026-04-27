import { Controller, Get, Param } from '@nestjs/common';
import { AgentsService, type AgentProfilePayload } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get(':id')
  get(@Param('id') id: string): Promise<AgentProfilePayload> {
    return this.agents.getProfile(id);
  }
}
