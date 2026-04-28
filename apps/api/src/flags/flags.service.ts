import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ListingFlag } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CredibilityService } from '../credibility/credibility.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Community flagging on active listings (doc §2.3 anti-fraud measures).
 * Anyone authed can flag; admin resolves. A `resolved_valid` outcome docks
 * the agent's listing_accuracy score and pauses the listing.
 */
@Injectable()
export class FlagsService {
  private readonly logger = new Logger(FlagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credibility: CredibilityService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(
    listingId: string,
    flaggedById: string,
    input: { reason: string; evidenceUrls?: string[] },
  ): Promise<ListingFlag> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    return this.prisma.listingFlag.create({
      data: {
        listingId,
        flaggedById,
        reason: input.reason,
        evidenceUrls: input.evidenceUrls ?? [],
      },
    });
  }

  async listOpen(): Promise<ListingFlag[]> {
    return this.prisma.listingFlag.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Renter-side history — what they've reported and the outcome. */
  async listMine(userId: string): Promise<ListingFlag[]> {
    return this.prisma.listingFlag.findMany({
      where: { flaggedById: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async resolve(
    flagId: string,
    valid: boolean,
    decisionNotes: string,
    actorUserId: string,
  ): Promise<ListingFlag> {
    const result = await this.prisma.$transaction(async (tx) => {
      const flag = await tx.listingFlag.findUnique({ where: { id: flagId } });
      if (!flag) throw new NotFoundException(`Flag ${flagId} not found`);
      if (flag.status !== 'open') throw new BadRequestException(`flag is ${flag.status}`);

      const status = valid ? 'resolved_valid' : 'resolved_invalid';
      const updated = await tx.listingFlag.update({
        where: { id: flagId },
        data: { status, decisionNotes, resolvedAt: new Date() },
      });

      const listing = await tx.listing.findUnique({ where: { id: flag.listingId } });
      if (!listing) throw new NotFoundException('listing missing');

      if (valid) {
        // Doc: "Misrepresented listing: immediate delisting, credibility
        // score docked". We pause it here; permanent ban is a separate
        // admin action under user moderation.
        await tx.listing.update({
          where: { id: listing.id },
          data: { status: 'paused' },
        });
        await this.credibility.record({
          subjectUserId: listing.ownerId,
          factor: 'listing_accuracy',
          delta: 0,
          reason: 'community_flag_upheld',
          contextRef: flagId,
          tx,
        });
        await this.notifications.notify({
          userId: listing.ownerId,
          kind: 'listing_rejected',
          title: 'Listing flagged',
          body: 'A community flag was upheld. The listing is paused.',
          href: `/listings/${listing.id}`,
          contextRef: flagId,
          tx,
        });
      }

      await this.audit.record({
        actorUserId,
        entity: 'listing_flag',
        entityId: flagId,
        action: 'resolve_flag',
        metadata: { listingId: listing.id, valid, status },
        tx,
      });

      return { flag: updated, ownerId: listing.ownerId, valid };
    });
    if (result.valid) {
      await this.credibility.refreshAgentSnapshot(result.ownerId);
    }
    return result.flag;
  }
}
