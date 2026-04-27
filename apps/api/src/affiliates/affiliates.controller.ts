import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Affiliate, AffiliateCategory } from '@prisma/client';
import type { Request } from 'express';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CreateAffiliateDto,
  CreateAffiliateSchema,
  RecordClickDto,
  RecordClickSchema,
} from './affiliates.dto';
import { AffiliatesService } from './affiliates.service';

const VALID_CATEGORIES: AffiliateCategory[] = [
  'movers',
  'internet',
  'dstv',
  'cleaning',
  'furniture',
  'utilities',
];

@Controller('affiliates')
export class AffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  /** Public — anyone can browse the partners. No PII involved. */
  @Get()
  list(@Query('category') category?: string): Promise<Affiliate[]> {
    if (category && !VALID_CATEGORIES.includes(category as AffiliateCategory)) {
      throw new BadRequestException(`unknown category ${category}`);
    }
    return this.affiliates.listActive(category as AffiliateCategory | undefined);
  }

  /**
   * Records a click and returns the redirect URL. Persist-then-redirect
   * so the data point survives even if the click-out fails. Anonymous
   * clicks are allowed (the move-in upsell is shown to logged-in renters,
   * but click attribution still works without auth — userId is opportunistic).
   */
  @Post('click')
  @UsePipes(new ZodValidationPipe(RecordClickSchema))
  async click(@Body() body: RecordClickDto, @Req() req: Request): Promise<{ redirect: string }> {
    const result = await this.affiliates.recordClick({
      affiliateId: body.affiliateId,
      userId: req.user?.id ?? null,
      contextRef: body.contextRef ?? null,
    });
    return { redirect: result.redirect };
  }

  // ── Admin ──

  @Post()
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(CreateAffiliateSchema))
  create(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreateAffiliateDto,
  ): Promise<Affiliate> {
    assertHasRole(user, 'admin');
    return this.affiliates.create(body);
  }

  @Post(':id/active')
  @UseGuards(CurrentUserGuard)
  toggle(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: { active: boolean },
  ): Promise<Affiliate> {
    assertHasRole(user, 'admin');
    return this.affiliates.setActive(id, body.active);
  }

  @Get(':id/stats')
  @UseGuards(CurrentUserGuard)
  stats(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<{ count: number }> {
    assertHasRole(user, 'admin');
    return this.affiliates.clickStats(id);
  }
}
