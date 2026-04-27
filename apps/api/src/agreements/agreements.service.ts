import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Document } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import type { GenerateAgreementDto } from './agreements.dto';

/**
 * Tenancy agreement template generator (doc §2.6 phase 3 + §6 Tier 4).
 * Structured fields → canonical body → hashed → anchored. Both parties
 * have to confirm the deal in-app first; the resulting hash is what the
 * doc names "the agreement cannot be retroactively altered by either
 * party or by Iloja" (§2.10).
 *
 * The PDF render itself is deferred — the immutable record is the hash,
 * and downloads are a UI-layer concern we'll add when agents start
 * needing a paper copy.
 */
@Injectable()
export class AgreementsService {
  private readonly logger = new Logger(AgreementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  async generate(input: GenerateAgreementDto, byUserId: string): Promise<Document> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: input.listingId },
    });
    if (!listing) throw new NotFoundException(`Listing ${input.listingId} not found`);
    // Only the agent (listing owner) may generate the agreement; renter
    // counter-signs by replying with their own write later.
    if (listing.ownerId !== byUserId) {
      throw new ForbiddenException('only the listing owner generates agreements');
    }
    const renter = await this.prisma.user.findUnique({ where: { id: input.renterId } });
    if (!renter) throw new NotFoundException(`Renter ${input.renterId} not found`);

    const body = {
      listingId: listing.id,
      listingTitle: listing.title,
      address: listing.address,
      neighborhood: listing.neighborhood,
      ownerId: listing.ownerId,
      renterId: renter.id,
      rentKobo: input.rentKobo.toString(),
      startDate: input.startDate,
      termMonths: input.termMonths,
      cautionKobo: input.cautionKobo?.toString() ?? null,
      additionalTerms: input.additionalTerms ?? '',
      generatedAt: new Date().toISOString(),
    };

    const doc = await this.documents.writeReceipt({
      type: 'tenancy_agreement',
      body,
      contextRef: `${listing.id}:${renter.id}`,
    });
    this.logger.log(`Tenancy agreement ${doc.id} generated for listing ${listing.id}`);
    return doc;
  }

  /**
   * Render the agreement as plaintext (the canonical body that was hashed).
   * The PDF is a downstream rendering of this — same content, same hash.
   */
  renderText(body: Record<string, unknown>): string {
    const lines = [
      'ILOJA TENANCY AGREEMENT',
      '',
      `Property: ${body.listingTitle}`,
      `Address: ${body.address}, ${body.neighborhood}`,
      '',
      `Landlord/Agent (Iloja user): ${body.ownerId}`,
      `Tenant (Iloja user): ${body.renterId}`,
      '',
      `Term: ${body.termMonths} months from ${body.startDate}`,
      `Annual rent: ₦${(Number(body.rentKobo) / 100).toLocaleString('en-NG')}`,
      body.cautionKobo
        ? `Caution / deposit: ₦${(Number(body.cautionKobo) / 100).toLocaleString('en-NG')}`
        : 'No caution / deposit required.',
      '',
      'Additional terms:',
      String(body.additionalTerms || '— none beyond the platform default.'),
      '',
      `Generated: ${body.generatedAt}`,
      'This agreement is registered as a Verified Record on Iloja and',
      'tamper-evident via SHA-256 anchoring on Base L2.',
    ];
    return lines.join('\n');
  }
}
