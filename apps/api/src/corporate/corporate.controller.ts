import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { CorporateAccount, Listing, PlacementRequest } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CreateCorporateAccountDto,
  CreateCorporateAccountSchema,
  CreatePlacementRequestDto,
  CreatePlacementRequestSchema,
  MatchPlacementDto,
  MatchPlacementSchema,
} from './corporate.dto';
import { CorporateService } from './corporate.service';

@Controller('corporate')
@UseGuards(CurrentUserGuard)
export class CorporateController {
  constructor(private readonly corporate: CorporateService) {}

  // ── Accounts ──

  @Get('accounts')
  listAccounts(@CurrentUserParam() user: CurrentUser): Promise<CorporateAccount[]> {
    assertHasRole(user, 'admin');
    return this.corporate.listAccounts();
  }

  @Post('accounts')
  @UsePipes(new ZodValidationPipe(CreateCorporateAccountSchema))
  createAccount(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreateCorporateAccountDto,
  ): Promise<CorporateAccount> {
    assertHasRole(user, 'admin');
    return this.corporate.createAccount(body);
  }

  // ── Placements ──

  @Get('placements')
  listPlacements(@CurrentUserParam() user: CurrentUser): Promise<PlacementRequest[]> {
    assertHasRole(user, 'admin');
    return this.corporate.listOpenRequests();
  }

  @Post('placements')
  @UsePipes(new ZodValidationPipe(CreatePlacementRequestSchema))
  createPlacement(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreatePlacementRequestDto,
  ): Promise<PlacementRequest> {
    assertHasRole(user, 'admin');
    return this.corporate.createRequest(body);
  }

  @Get('placements/:id/matches')
  suggestMatches(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<Listing[]> {
    assertHasRole(user, 'admin');
    return this.corporate.suggestMatches(id);
  }

  @Post('placements/:id/match')
  @UsePipes(new ZodValidationPipe(MatchPlacementSchema))
  matchPlacement(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: MatchPlacementDto,
  ): Promise<PlacementRequest> {
    assertHasRole(user, 'admin');
    return this.corporate.match(id, body.matchedListingId, body.placedRenterId);
  }

  @Post('placements/:id/cancel')
  cancelPlacement(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<PlacementRequest> {
    assertHasRole(user, 'admin');
    return this.corporate.cancelRequest(id);
  }
}
