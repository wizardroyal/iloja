import { Injectable, NotFoundException } from '@nestjs/common';
import type { Listing, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(ownerId: string, input: Prisma.ListingUncheckedCreateInput): Promise<Listing> {
    return this.prisma.listing.create({
      data: { ...input, ownerId, status: 'draft' },
    });
  }

  async findActive(params: {
    type?: 'short_let' | 'long_term' | 'commercial';
    neighborhood?: string;
    take?: number;
  }): Promise<Listing[]> {
    return this.prisma.listing.findMany({
      where: {
        status: 'active',
        ...(params.type ? { type: params.type } : {}),
        ...(params.neighborhood ? { neighborhood: params.neighborhood } : {}),
      },
      orderBy: { verifiedAt: 'desc' },
      take: params.take ?? 20,
      include: { photos: { orderBy: { position: 'asc' }, take: 1 } },
    });
  }

  async findById(id: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { photos: { orderBy: { position: 'asc' } } },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    return listing;
  }

  /**
   * Submit a draft for verification. The verification job is created by
   * VerificationService elsewhere — this method only flips the listing state.
   */
  async submitForVerification(id: string, ownerId: string): Promise<Listing> {
    const listing = await this.prisma.listing.findFirst({ where: { id, ownerId } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    if (listing.status !== 'draft') {
      throw new NotFoundException(`Listing ${id} is not a draft`);
    }
    return this.prisma.listing.update({
      where: { id },
      data: { status: 'pending_verification' },
    });
  }
}
