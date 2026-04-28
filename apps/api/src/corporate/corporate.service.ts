import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CorporateAccount, Listing, PlacementRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Doc §6 Tier 3 corporate concierge. CorporateAccount = the HR-facing
 * partner. PlacementRequest = a single relocation order. Iloja ops
 * matches against active listings and confirms placement.
 */
@Injectable()
export class CorporateService {
  private readonly logger = new Logger(CorporateService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Accounts (admin-managed) ──

  async listAccounts(): Promise<CorporateAccount[]> {
    return this.prisma.corporateAccount.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async createAccount(input: {
    name: string;
    notes?: string;
    placementFeeKobo: bigint;
    contactPhone?: string;
    contactEmail?: string;
  }): Promise<CorporateAccount> {
    return this.prisma.corporateAccount.create({
      data: {
        name: input.name,
        notes: input.notes ?? null,
        placementFeeKobo: input.placementFeeKobo,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
      },
    });
  }

  // ── Placement requests ──

  async listOpenRequests(): Promise<PlacementRequest[]> {
    return this.prisma.placementRequest.findMany({
      where: { status: { in: ['open', 'matched'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRequest(input: {
    corporateAccountId: string;
    hrContactName: string;
    budgetMinKobo?: bigint;
    budgetMaxKobo?: bigint;
    bedrooms?: number;
    preferredZones?: string[];
    needBy?: string;
    notes?: string;
  }): Promise<PlacementRequest> {
    const account = await this.prisma.corporateAccount.findUnique({
      where: { id: input.corporateAccountId },
    });
    if (!account || !account.active) {
      throw new NotFoundException(`Corporate account ${input.corporateAccountId} not active`);
    }
    return this.prisma.placementRequest.create({
      data: {
        corporateAccountId: account.id,
        hrContactName: input.hrContactName,
        budgetMinKobo: input.budgetMinKobo ?? null,
        budgetMaxKobo: input.budgetMaxKobo ?? null,
        bedrooms: input.bedrooms ?? null,
        preferredZones: input.preferredZones ?? [],
        needBy: input.needBy ? new Date(input.needBy) : null,
        notes: input.notes ?? null,
      },
    });
  }

  /**
   * Suggests active listings for a placement based on its filter spec.
   * Returns the top 20 sorted by closeness to the budget mid-point.
   */
  async suggestMatches(requestId: string): Promise<Listing[]> {
    const request = await this.prisma.placementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Placement ${requestId} not found`);
    const where: Parameters<typeof this.prisma.listing.findMany>[0] = {
      where: {
        status: 'active',
        ...(request.bedrooms !== null ? { bedrooms: request.bedrooms } : {}),
        ...(request.preferredZones.length > 0
          ? { neighborhood: { in: request.preferredZones } }
          : {}),
        ...(request.budgetMinKobo !== null || request.budgetMaxKobo !== null
          ? {
              priceKobo: {
                ...(request.budgetMinKobo !== null ? { gte: request.budgetMinKobo } : {}),
                ...(request.budgetMaxKobo !== null ? { lte: request.budgetMaxKobo } : {}),
              },
            }
          : {}),
      },
      orderBy: { verifiedAt: 'desc' },
      take: 20,
    };
    return this.prisma.listing.findMany(where);
  }

  async match(
    requestId: string,
    matchedListingId: string,
    placedRenterId?: string,
  ): Promise<PlacementRequest> {
    const request = await this.prisma.placementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Placement ${requestId} not found`);
    if (request.status === 'placed' || request.status === 'cancelled') {
      throw new BadRequestException(`placement is ${request.status}`);
    }
    return this.prisma.placementRequest.update({
      where: { id: requestId },
      data: {
        status: placedRenterId ? 'placed' : 'matched',
        matchedListingId,
        placedRenterId: placedRenterId ?? null,
        placedAt: placedRenterId ? new Date() : null,
      },
    });
  }

  async cancelRequest(requestId: string): Promise<PlacementRequest> {
    const request = await this.prisma.placementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Placement ${requestId} not found`);
    if (request.status === 'placed') {
      throw new BadRequestException('cannot cancel a placed request');
    }
    return this.prisma.placementRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled' },
    });
  }
}
