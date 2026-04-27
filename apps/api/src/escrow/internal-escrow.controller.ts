import { Controller, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { EscrowService } from './escrow.service';

/**
 * Internal endpoint the worker hits when an escrow auto-release timer fires.
 * Authenticated by a shared secret out-of-band — never exposed to public
 * traffic. Idempotent at the service layer.
 */
@Controller('internal/escrow')
export class InternalEscrowController {
  constructor(private readonly escrow: EscrowService) {}

  @Post(':id/auto-release')
  async autoRelease(
    @Param('id') id: string,
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<{ acted: boolean }> {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
    return this.escrow.autoRelease(id);
  }
}
