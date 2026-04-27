import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentProfile, Inspection, Listing, Review, Thread, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AgentProfilePayload {
  user: Pick<User, 'id' | 'fullName' | 'createdAt'>;
  profile: AgentProfile | null;
  listings: Listing[];
  reviews: Review[];
  stats: {
    activeListings: number;
    averageRating: number | null;
    reviewCount: number;
  };
}

export interface AgentDashboardPayload {
  profile: AgentProfile | null;
  /** Active conversations on the agent's listings — the lead pipeline. */
  leads: (Thread & {
    /** Whichever listing the thread is for, denormalised. */
    listingTitle: string;
    listingNeighborhood: string;
    /** Computed: messages from renter that haven't been read yet. */
    unread: number;
  })[];
  upcomingInspections: Inspection[];
  /** Per-listing aggregate counters for the analytics tab. */
  listingAnalytics: {
    listingId: string;
    title: string;
    status: string;
    totalThreads: number;
    confirmedInspections: number;
    completedEscrows: number;
  }[];
  totals: {
    activeListings: number;
    pendingVerifications: number;
    totalLeads: number;
    inspectionsThisWeek: number;
  };
}

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the agent dashboard (port of screen 06): score, leads, upcoming
   * inspections, per-listing analytics. Read-only — doc lists CRM
   * subscription as Phase 2.
   */
  async getDashboard(userId: string): Promise<AgentDashboardPayload> {
    const [profile, allListings, threads, inspections] = await Promise.all([
      this.prisma.agentProfile.findUnique({ where: { userId } }),
      this.prisma.listing.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.thread.findMany({
        where: { agentId: userId },
        orderBy: { lastActiveAt: 'desc' },
        take: 50,
      }),
      this.prisma.inspection.findMany({
        where: {
          byUserId: userId,
          status: { in: ['proposed', 'confirmed'] },
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 20,
      }),
    ]);

    const listingMap = new Map(allListings.map((l) => [l.id, l]));
    const unreadByThread = new Map<string, number>();
    if (threads.length > 0) {
      const grouped = await this.prisma.chatMessage.groupBy({
        by: ['threadId'],
        where: {
          threadId: { in: threads.map((t) => t.id) },
          readAt: null,
          byUserId: { not: userId },
        },
        _count: { _all: true },
      });
      for (const g of grouped) {
        unreadByThread.set(g.threadId, g._count._all);
      }
    }

    const leads = threads.map((t) => {
      const listing = listingMap.get(t.listingId);
      return {
        ...t,
        listingTitle: listing?.title ?? '(deleted listing)',
        listingNeighborhood: listing?.neighborhood ?? '',
        unread: unreadByThread.get(t.id) ?? 0,
      };
    });

    // Per-listing analytics — three quick aggregations.
    const listingIds = allListings.map((l) => l.id);
    const [threadCounts, confirmedCounts, releasedEscrows] =
      listingIds.length === 0
        ? [[], [], []]
        : await Promise.all([
            this.prisma.thread.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds } },
              _count: { _all: true },
            }),
            this.prisma.inspection.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, status: 'confirmed' },
              _count: { _all: true },
            }),
            this.prisma.escrow.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, state: 'released' },
              _count: { _all: true },
            }),
          ]);

    const threadCount = new Map(threadCounts.map((c) => [c.listingId, c._count._all]));
    const inspectionCount = new Map(confirmedCounts.map((c) => [c.listingId, c._count._all]));
    const escrowCount = new Map(releasedEscrows.map((c) => [c.listingId ?? '', c._count._all]));

    const listingAnalytics = allListings.map((l) => ({
      listingId: l.id,
      title: l.title,
      status: l.status,
      totalThreads: threadCount.get(l.id) ?? 0,
      confirmedInspections: inspectionCount.get(l.id) ?? 0,
      completedEscrows: escrowCount.get(l.id) ?? 0,
    }));

    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    const inspectionsThisWeek = inspections.filter(
      (i) => i.scheduledAt.getTime() < startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).length;

    return {
      profile,
      leads,
      upcomingInspections: inspections,
      listingAnalytics,
      totals: {
        activeListings: allListings.filter((l) => l.status === 'active').length,
        pendingVerifications: allListings.filter((l) => l.status === 'pending_verification').length,
        totalLeads: leads.length,
        inspectionsThisWeek,
      },
    };
  }

  async getProfile(userId: string): Promise<AgentProfilePayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { agentProfile: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const [listings, reviews] = await Promise.all([
      this.prisma.listing.findMany({
        where: { ownerId: userId, status: 'active' },
        orderBy: { verifiedAt: 'desc' },
        include: { photos: { orderBy: { position: 'asc' }, take: 1 } },
      }),
      this.prisma.review.findMany({
        where: { subjectUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : null;

    return {
      user: { id: user.id, fullName: user.fullName, createdAt: user.createdAt },
      profile: user.agentProfile,
      listings,
      reviews,
      stats: {
        activeListings: listings.length,
        averageRating,
        reviewCount,
      },
    };
  }
}
