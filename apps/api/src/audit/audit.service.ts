import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type AuditLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  actorUserId: string;
  entity: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  tx?: Prisma.TransactionClient;
}

/**
 * Append-only audit log of admin mutations. Plan §8 cross-cutting concerns:
 * "audit log for admin actions". Combined with NDPR's right-to-know, this
 * is the answer to "who changed what, when".
 *
 * The metadata field is the caller's responsibility — sanitise PII before
 * passing it. Phone numbers, NIN, BVN must never land here.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<AuditLog> {
    const client = input.tx ?? this.prisma;
    const row = await client.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    this.logger.log(`audit ${input.action} ${input.entity}:${input.entityId} by ${input.actorUserId}`);
    return row;
  }

  async listForEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listForActor(actorUserId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { actorUserId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
