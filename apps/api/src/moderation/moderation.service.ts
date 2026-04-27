import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { UserRestriction, UserRestrictionKind } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin user moderation. Doc §2.9 lists this as core internal infra:
 * "User account management — warnings, restrictions, bans and appeals".
 *
 * Active restrictions are enforced at the API boundary by future
 * middleware; for now writes simply land in the database and surface in
 * the admin UI.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async restrict(input: {
    userId: string;
    issuedById: string;
    kind: UserRestrictionKind;
    reason: string;
    expiresAt?: string;
  }): Promise<UserRestriction> {
    const target = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!target) throw new NotFoundException(`User ${input.userId} not found`);

    if (input.kind === 'permanent_ban' && input.expiresAt) {
      throw new BadRequestException('permanent_ban cannot have expiresAt');
    }

    const restriction = await this.prisma.userRestriction.create({
      data: {
        userId: input.userId,
        issuedById: input.issuedById,
        kind: input.kind,
        reason: input.reason,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await this.notifications.notify({
      userId: input.userId,
      kind: 'listing_rejected', // closest existing kind; refine as we add more
      title: titleFor(input.kind),
      body: input.reason,
    });

    this.logger.warn(`User ${input.userId} restricted: ${input.kind}`);
    return restriction;
  }

  async lift(restrictionId: string, issuedById: string): Promise<UserRestriction> {
    const r = await this.prisma.userRestriction.findUnique({ where: { id: restrictionId } });
    if (!r) throw new NotFoundException(`Restriction ${restrictionId} not found`);
    if (r.liftedAt) throw new BadRequestException('already lifted');
    this.logger.log(`Restriction ${restrictionId} lifted by ${issuedById}`);
    return this.prisma.userRestriction.update({
      where: { id: restrictionId },
      data: { liftedAt: new Date() },
    });
  }

  async listForUser(userId: string): Promise<UserRestriction[]> {
    return this.prisma.userRestriction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listActive(): Promise<UserRestriction[]> {
    const now = new Date();
    return this.prisma.userRestriction.findMany({
      where: {
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

function titleFor(kind: UserRestrictionKind): string {
  switch (kind) {
    case 'warning':
      return 'Account warning';
    case 'inspection_cooldown':
      return 'Inspection cooldown';
    case 'account_suspended':
      return 'Account suspended';
    case 'permanent_ban':
      return 'Account banned';
  }
}
