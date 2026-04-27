import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(CurrentUserGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('entity/:entity/:entityId')
  forEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<AuditLog[]> {
    assertHasRole(user, 'admin');
    return this.audit.listForEntity(entity, entityId);
  }

  @Get('actor')
  forActor(
    @CurrentUserParam() user: CurrentUser,
    @Query('userId') userId: string | undefined,
  ): Promise<AuditLog[]> {
    assertHasRole(user, 'admin');
    return this.audit.listForActor(userId ?? user.id);
  }
}
