import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { SavedSearch } from '@prisma/client';
import { CurrentUser, CurrentUserGuard, CurrentUserParam } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CreateSavedSearchDto, CreateSavedSearchSchema } from './saved-searches.dto';
import { SavedSearchesService } from './saved-searches.service';

@Controller()
export class SavedSearchesController {
  constructor(private readonly searches: SavedSearchesService) {}

  @Get('saved-searches')
  @UseGuards(CurrentUserGuard)
  list(@CurrentUserParam() user: CurrentUser): Promise<SavedSearch[]> {
    return this.searches.listForUser(user.id);
  }

  @Post('saved-searches')
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(CreateSavedSearchSchema))
  create(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreateSavedSearchDto,
  ): Promise<SavedSearch> {
    return this.searches.create(user.id, body);
  }

  @Delete('saved-searches/:id')
  @UseGuards(CurrentUserGuard)
  remove(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<{ ok: true }> {
    return this.searches.remove(id, user.id);
  }

  /**
   * Worker entrypoint — runs every saved search and notifies on matches.
   * Same shared-secret guard pattern as the other internal endpoints.
   */
  @Post('internal/saved-searches/run-alerts')
  @HttpCode(200)
  async runAlerts(
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<{ alerts: number; searches: number }> {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
    return this.searches.runAlerts();
  }
}
