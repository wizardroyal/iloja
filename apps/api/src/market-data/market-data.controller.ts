import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { MarketDataService, type MarketSnapshot } from './market-data.service';

/**
 * Doc §6 Tier 4 market data product. Admin-gated for now — once a
 * customer pays, ops issues an API key tied to a special `market_data`
 * role. The shape is stable so the JSON itself can become a paid
 * product without reshipping anything.
 */
@Controller('market-data')
@UseGuards(CurrentUserGuard)
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get('snapshot')
  snapshot(@CurrentUserParam() user: CurrentUser): Promise<MarketSnapshot> {
    assertHasRole(user, 'admin');
    return this.marketData.snapshot();
  }
}
