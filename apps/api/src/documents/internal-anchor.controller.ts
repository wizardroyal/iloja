import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type { Document } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHAIN_ANCHOR_PROVIDER,
  type ChainAnchorProvider,
} from '../providers/chain/chain-anchor.provider';

/**
 * Internal endpoints the chain-anchor worker calls. Authenticated by the
 * shared INTERNAL_SECRET — never exposed to public traffic.
 *
 *   GET  /internal/documents/pending?limit=N — drain rows still pending
 *   POST /internal/documents/anchored        — record successful tx
 *   POST /internal/documents/anchor-failed   — mark failed for retry
 */
@Controller('internal/documents')
export class InternalAnchorController {
  private readonly logger = new Logger(InternalAnchorController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHAIN_ANCHOR_PROVIDER) private readonly chain: ChainAnchorProvider,
  ) {}

  @Get('pending')
  async pending(
    @Query('limit') limit: string | undefined,
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<Document[]> {
    this.assertSecret(secret);
    const take = Math.min(Number(limit ?? 100), 500);
    return this.prisma.document.findMany({
      where: { anchorStatus: 'pending' },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  /**
   * Worker-side convenience: anchor + persist in one shot. Keeps the
   * provider out of the worker process so chain config (RPC, relayer key,
   * gas params) lives entirely on the API tier.
   */
  @Post('anchor-batch')
  async anchorBatch(
    @Body() body: { ids: string[] },
    @Headers('x-iloja-internal-secret') secret: string | undefined,
  ): Promise<{ anchored: number; failed: number }> {
    this.assertSecret(secret);
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids[] required');
    }
    let anchored = 0;
    let failed = 0;
    for (const id of body.ids) {
      const doc = await this.prisma.document.findUnique({ where: { id } });
      if (!doc || doc.anchorStatus === 'confirmed') continue;
      try {
        const receipt = await this.chain.anchor({
          hash: doc.hash,
          docType: doc.type,
          uri: doc.uri,
        });
        await this.prisma.document.update({
          where: { id },
          data: {
            anchorStatus: 'confirmed',
            txHash: receipt.txHash,
            blockNumber: receipt.blockNumber,
            anchoredAt: new Date(),
          },
        });
        anchored += 1;
      } catch (err) {
        this.logger.error(`Anchor ${id} failed: ${(err as Error).message}`);
        await this.prisma.document.update({
          where: { id },
          data: { anchorStatus: 'failed' },
        });
        failed += 1;
      }
    }
    return { anchored, failed };
  }

  private assertSecret(secret: string | undefined): void {
    const expected = process.env.INTERNAL_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('invalid internal secret');
    }
  }
}
