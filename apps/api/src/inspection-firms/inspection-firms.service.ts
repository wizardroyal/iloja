import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { InspectionFirm, InspectionFirmBooking } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BPS_DIVISOR = BigInt(10_000);

/**
 * Doc §2.3 phase 3 third-party inspection marketplace. The firm sets a
 * rate; Iloja takes a coordination fee in basis points off the top. We
 * snapshot both at booking time so later rate changes don't rewrite
 * historical bookings.
 */
@Injectable()
export class InspectionFirmsService {
  private readonly logger = new Logger(InspectionFirmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listActive(zone?: string): Promise<InspectionFirm[]> {
    return this.prisma.inspectionFirm.findMany({
      where: {
        active: true,
        ...(zone ? { zones: { has: zone } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: {
    name: string;
    zones: string[];
    rateKobo: bigint;
    coordinationBps?: number;
    contactPhone?: string;
    contactEmail?: string;
  }): Promise<InspectionFirm> {
    return this.prisma.inspectionFirm.create({
      data: {
        name: input.name,
        zones: input.zones,
        rateKobo: input.rateKobo,
        coordinationBps: input.coordinationBps ?? 500,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
      },
    });
  }

  async setActive(id: string, active: boolean): Promise<InspectionFirm> {
    const firm = await this.prisma.inspectionFirm.findUnique({ where: { id } });
    if (!firm) throw new NotFoundException(`Firm ${id} not found`);
    return this.prisma.inspectionFirm.update({ where: { id }, data: { active } });
  }

  async book(input: {
    firmId: string;
    listingId: string;
    byUserId: string;
    scheduledAt?: string;
    notes?: string;
  }): Promise<InspectionFirmBooking> {
    const firm = await this.prisma.inspectionFirm.findUnique({ where: { id: input.firmId } });
    if (!firm || !firm.active) throw new NotFoundException(`Firm ${input.firmId} not active`);

    const listing = await this.prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw new NotFoundException(`Listing ${input.listingId} not found`);
    if (listing.ownerId !== input.byUserId) {
      throw new ForbiddenException('only the listing owner can book a firm inspection');
    }
    if (!firm.zones.some((z) => z === listing.neighborhood)) {
      throw new BadRequestException(
        `firm "${firm.name}" doesn't cover ${listing.neighborhood}`,
      );
    }

    const coordinationFeeKobo = (firm.rateKobo * BigInt(firm.coordinationBps)) / BPS_DIVISOR;
    return this.prisma.inspectionFirmBooking.create({
      data: {
        firmId: firm.id,
        byUserId: input.byUserId,
        listingId: listing.id,
        rateKobo: firm.rateKobo,
        coordinationFeeKobo,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        notes: input.notes ?? null,
        status: 'pending',
      },
    });
  }

  async accept(bookingId: string): Promise<InspectionFirmBooking> {
    return this.transition(bookingId, 'pending', 'accepted', { acceptedAt: new Date() });
  }

  async complete(bookingId: string): Promise<InspectionFirmBooking> {
    return this.transition(bookingId, 'accepted', 'completed', { completedAt: new Date() });
  }

  async cancel(bookingId: string): Promise<InspectionFirmBooking> {
    const booking = await this.prisma.inspectionFirmBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new BadRequestException(`booking is ${booking.status}`);
    }
    return this.prisma.inspectionFirmBooking.update({
      where: { id: bookingId },
      data: { status: 'cancelled' },
    });
  }

  async listMyBookings(userId: string): Promise<InspectionFirmBooking[]> {
    return this.prisma.inspectionFirmBooking.findMany({
      where: { byUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async transition(
    bookingId: string,
    expected: InspectionFirmBooking['status'],
    next: InspectionFirmBooking['status'],
    extra: Partial<InspectionFirmBooking>,
  ): Promise<InspectionFirmBooking> {
    const booking = await this.prisma.inspectionFirmBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);
    if (booking.status !== expected) {
      throw new BadRequestException(`booking is ${booking.status}, expected ${expected}`);
    }
    return this.prisma.inspectionFirmBooking.update({
      where: { id: bookingId },
      data: { status: next, ...extra },
    });
  }
}
