import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Listing, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateListingDraftDto,
  ListingSubmissionRequiredSchema,
  UpdateListingDraftDto,
} from './listings.dto';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(ownerId: string, input: CreateListingDraftDto): Promise<Listing> {
    return this.prisma.listing.create({
      data: {
        ownerId,
        status: 'draft',
        type: input.type,
        title: input.title ?? '',
        description: input.description ?? '',
        bedrooms: input.bedrooms ?? 0,
        bathrooms: input.bathrooms ?? 0,
        priceKobo: input.priceKobo ?? BigInt(0),
        pricePeriod: input.pricePeriod ?? 'year',
        neighborhood: input.neighborhood ?? '',
        address: input.address ?? '',
        lat: input.lat ?? 0,
        lng: input.lng ?? 0,
        amenities: input.amenities ?? [],
      },
    });
  }

  async updateDraft(id: string, ownerId: string, input: UpdateListingDraftDto): Promise<Listing> {
    const existing = await this.prisma.listing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);
    if (existing.ownerId !== ownerId) throw new ForbiddenException('not your listing');
    if (existing.status !== 'draft') {
      throw new BadRequestException(`cannot edit listing in status ${existing.status}`);
    }
    const data: Prisma.ListingUpdateInput = { ...input };
    return this.prisma.listing.update({ where: { id }, data });
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

  async findOwn(ownerId: string): Promise<Listing[]> {
    return this.prisma.listing.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Validate that all required fields are present, transition to
   * pending_verification, and create the verification job that operators will
   * pick up from the queue.
   */
  async submitForVerification(id: string, ownerId: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    if (listing.ownerId !== ownerId) throw new ForbiddenException('not your listing');
    if (listing.status !== 'draft') {
      throw new BadRequestException(`listing is in status ${listing.status}, expected draft`);
    }

    const parsed = ListingSubmissionRequiredSchema.safeParse(listing);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'listing missing required fields',
        issues: parsed.error.issues,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id },
        data: { status: 'pending_verification' },
      });
      await tx.verificationJob.create({
        data: { listingId: id, status: 'unclaimed' },
      });
      return updated;
    });
  }
}
