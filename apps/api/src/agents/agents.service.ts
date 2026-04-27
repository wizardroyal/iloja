import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentProfile, Listing, Review, User } from '@prisma/client';
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

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

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
