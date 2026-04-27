import { Injectable, Logger } from '@nestjs/common';
import type { Document, DocumentType, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Generates the document rows that the chain anchor worker writes to Base
 * L2. Per the doc, only the SHA-256 hash + uri tuple goes on-chain; the
 * full body lives here in the DB. The wire format we hash must be
 * canonical so a re-render of the same receipt produces the same hash.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async writeReceipt(input: {
    type: DocumentType;
    body: Record<string, unknown>;
    contextRef: string;
    tx?: Prisma.TransactionClient;
  }): Promise<Document> {
    const client = input.tx ?? this.prisma;
    const canonical = canonicalize(input.body);
    const hash = '0x' + createHash('sha256').update(canonical).digest('hex');
    const uri = `iloja://documents/${input.type}/${input.contextRef}`;

    // contextRef + type already singletons every business event, but we
    // also dedupe on hash so the same canonical body never produces two
    // rows.
    const existing = await client.document.findUnique({ where: { hash } });
    if (existing) return existing;

    const doc = await client.document.create({
      data: {
        type: input.type,
        hash,
        uri,
        contextRef: input.contextRef,
        anchorStatus: 'pending',
      },
    });
    this.logger.log(`Document ${doc.id} (${input.type}) staged for anchor: ${hash.slice(0, 18)}…`);
    return doc;
  }

  async findByHash(hash: string): Promise<Document | null> {
    return this.prisma.document.findUnique({ where: { hash } });
  }

  async findByContextRef(contextRef: string): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { contextRef },
      orderBy: { createdAt: 'asc' },
    });
  }
}

/**
 * Stable JSON encoding: sorted keys, no whitespace. Hashing this ensures
 * the same logical document produces the same digest regardless of the
 * caller's object construction order.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k]),
  );
  return '{' + parts.join(',') + '}';
}
