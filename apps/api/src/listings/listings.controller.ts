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
import type { Listing, ListingPhoto } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  AddListingPhotoDto,
  AddListingPhotoSchema,
  CreateListingDraftDto,
  CreateListingDraftSchema,
  UpdateListingDraftDto,
  UpdateListingDraftSchema,
  UpdateListingScheduleDto,
  UpdateListingScheduleSchema,
} from './listings.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(
    @Query('type') type?: 'short_let' | 'long_term' | 'commercial',
    @Query('neighborhood') neighborhood?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('minPriceKobo') minPriceKobo?: string,
    @Query('maxPriceKobo') maxPriceKobo?: string,
  ): Promise<Listing[]> {
    return this.listings.findActive({
      type,
      neighborhood,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      minPriceKobo: minPriceKobo ? BigInt(minPriceKobo) : undefined,
      maxPriceKobo: maxPriceKobo ? BigInt(maxPriceKobo) : undefined,
    });
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

  @Get(':id/photos')
  listPhotos(@Param('id') id: string): Promise<ListingPhoto[]> {
    return this.listings.listPhotos(id);
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

  @Post(':id/photos')
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(AddListingPhotoSchema))
  addPhoto(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: AddListingPhotoDto,
  ): Promise<ListingPhoto> {
    return this.listings.addPhoto(id, user.id, body);
  }

  @Patch(':id/schedule')
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(UpdateListingScheduleSchema))
  updateSchedule(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: UpdateListingScheduleDto,
  ): Promise<Listing> {
    return this.listings.updateSchedule(id, user.id, body);
  }
}
