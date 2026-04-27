import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Listing } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CreateListingDraftDto,
  CreateListingDraftSchema,
  UpdateListingDraftDto,
  UpdateListingDraftSchema,
} from './listings.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(
    @Query('type') type?: 'short_let' | 'long_term' | 'commercial',
    @Query('neighborhood') neighborhood?: string,
  ): Promise<Listing[]> {
    return this.listings.findActive({ type, neighborhood });
  }

  @Get('mine')
  @UseGuards(CurrentUserGuard)
  mine(@CurrentUserParam() user: CurrentUser): Promise<Listing[]> {
    assertHasRole(user, 'agent', 'landlord');
    return this.listings.findOwn(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<Listing> {
    return this.listings.findById(id);
  }

  @Post()
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(CreateListingDraftSchema))
  create(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreateListingDraftDto,
  ): Promise<Listing> {
    assertHasRole(user, 'agent', 'landlord');
    return this.listings.createDraft(user.id, body);
  }

  @Patch(':id')
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(UpdateListingDraftSchema))
  update(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: UpdateListingDraftDto,
  ): Promise<Listing> {
    return this.listings.updateDraft(id, user.id, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @UseGuards(CurrentUserGuard)
  submit(@Param('id') id: string, @CurrentUserParam() user: CurrentUser): Promise<Listing> {
    return this.listings.submitForVerification(id, user.id);
  }
}
