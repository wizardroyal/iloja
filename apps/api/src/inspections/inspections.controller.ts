import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Inspection } from '@prisma/client';
import { CurrentUser, CurrentUserGuard, CurrentUserParam } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProposeInspectionDto, ProposeInspectionSchema } from './inspections.dto';
import { InspectionsService } from './inspections.service';

@Controller('inspections')
@UseGuards(CurrentUserGuard)
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Get()
  list(
    @CurrentUserParam() user: CurrentUser,
    @Query('threadId') threadId: string,
  ): Promise<Inspection[]> {
    return this.inspections.listForThread(threadId, user.id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(ProposeInspectionSchema))
  propose(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: ProposeInspectionDto,
  ): Promise<Inspection> {
    return this.inspections.propose(body.threadId, user.id, body.scheduledAt);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<Inspection> {
    return this.inspections.confirm(id, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<Inspection> {
    return this.inspections.cancel(id, user.id);
  }
}
