import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Payout, UserBankAccount } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SetBankAccountDto, SetBankAccountSchema } from './payouts.dto';
import { PayoutsService } from './payouts.service';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('bank-account')
  @UseGuards(CurrentUserGuard)
  bankAccount(@CurrentUserParam() user: CurrentUser): Promise<UserBankAccount | null> {
    return this.payouts.getBankAccount(user.id);
  }

  @Put('bank-account')
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(SetBankAccountSchema))
  setBank(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: SetBankAccountDto,
  ): Promise<UserBankAccount> {
    return this.payouts.setBankAccount(user.id, body);
  }

  @Get('mine')
  @UseGuards(CurrentUserGuard)
  mine(@CurrentUserParam() user: CurrentUser): Promise<Payout[]> {
    return this.payouts.listMyPayouts(user.id);
  }

  @Post(':id/requeue')
  @UseGuards(CurrentUserGuard)
  requeue(@Param('id') id: string, @CurrentUserParam() user: CurrentUser): Promise<Payout> {
    assertHasRole(user, 'admin');
    return this.payouts.requeue(id);
  }

  /**
   * Worker entrypoint. Drain queued payouts; same shared-secret pattern as
   * the other internal endpoints.
   */
  @Post('internal/dispatch')
  @HttpCode(200)
  async dispatch(
    @Body() body: { id: string },
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<Payout> {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
    return this.payouts.dispatch(body.id);
  }

  @Get('internal/queued')
  async queued(
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<Payout[]> {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
    return this.payouts.listQueued();
  }
}
