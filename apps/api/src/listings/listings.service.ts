import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { Listing, ListingPhoto, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GEOCODING_PROVIDER,
  type GeocodingProvider,
} from '../providers/geocoding/geocoding.provider';
import {
  CreateListingDraftDto,
  ListingSubmissionRequiredSchema,
  UpdateListingDraftDto,
} from './listings.dto';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(GEOCODING_PROVIDER) private readonly geocoder?: GeocodingProvider,
  ) {}

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
   * Validate that all required fields are present, server-geocode the address
   * if coordinates are missing (we never trust client-supplied lat/lng for the
   * verification check), transition to pending_verification, and create the
   * verification job in a single transaction.
   */
  async submitForVerification(id: string, ownerId: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    if (listing.ownerId !== ownerId) throw new ForbiddenException('not your listing');
    if (listing.status !== 'draft') {
      throw new BadRequestException(`listing is in status ${listing.status}, expected draft`);
    }

    let { lat, lng } = listing;
    if ((lat === 0 || lng === 0) && this.geocoder && listing.address) {
      const result = await this.geocoder.geocode(listing.address);
      if (!result || result.confidence < 0.5) {
        throw new BadRequestException(
          `could not geocode address: ${listing.address}. Edit and try again.`,
        );
      }
      lat = result.lat;
      lng = result.lng;
      this.logger.log(`Geocoded "${listing.address}" -> (${lat}, ${lng})`);
    }

    const parsed = ListingSubmissionRequiredSchema.safeParse({ ...listing, lat, lng });
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'listing missing required fields',
        issues: parsed.error.issues,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id },
        data: { status: 'pending_verification', lat, lng },
      });
      await tx.verificationJob.create({
        data: { listingId: id, status: 'unclaimed' },
      });
      return updated;
    });
  }

  async addPhoto(
    listingId: string,
    ownerId: string,
    input: { url: string; position: number },
  ): Promise<ListingPhoto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== ownerId) throw new ForbiddenException('not your listing');
    return this.prisma.listingPhoto.create({
      data: { listingId, url: input.url, position: input.position },
    });
  }

  async listPhotos(listingId: string): Promise<ListingPhoto[]> {
    return this.prisma.listingPhoto.findMany({
      where: { listingId },
      orderBy: { position: 'asc' },
    });
  }
}
