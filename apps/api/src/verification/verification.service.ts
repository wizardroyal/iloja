import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { VerificationJob } from '@prisma/client';
import { haversineMetres } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import type { SubmitVerificationDto } from './verification.dto';

/** Threshold from the doc: 200m mismatch flags for human review. */
const GPS_MISMATCH_THRESHOLD_M = 200;

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUnclaimed(): Promise<VerificationJob[]> {
    return this.prisma.verificationJob.findMany({
      where: { status: 'unclaimed' },
      orderBy: { createdAt: 'asc' },
      include: { listing: true },
    });
  }

  async listByStatus(
    status: 'unclaimed' | 'claimed' | 'submitted' | 'approved' | 'rejected',
  ): Promise<VerificationJob[]> {
    return this.prisma.verificationJob.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      include: { listing: true, artefacts: true },
    });
  }

  async findById(id: string): Promise<VerificationJob> {
    const job = await this.prisma.verificationJob.findUnique({
      where: { id },
      include: { listing: true, artefacts: true },
    });
    if (!job) throw new NotFoundException(`Verification job ${id} not found`);
    return job;
  }

  async claim(jobId: string, operatorId: string): Promise<VerificationJob> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.verificationJob.findUnique({ where: { id: jobId } });
      if (!job) throw new NotFoundException(`Verification job ${jobId} not found`);
      if (job.status !== 'unclaimed') {
        throw new BadRequestException(`job already ${job.status}`);
      }
      return tx.verificationJob.update({
        where: { id: jobId },
        data: { status: 'claimed', operatorId },
      });
    });
  }

  /**
   * Operator submits the captured artefacts. We compute the distance between
   * the operator's median GPS point and the geocoded listing address; > 200m
   * is recorded for the admin reviewer.
   */
  async submit(
    jobId: string,
    operatorId: string,
    input: SubmitVerificationDto,
  ): Promise<VerificationJob> {
    const job = await this.prisma.verificationJob.findUnique({
      where: { id: jobId },
      include: { listing: true },
    });
    if (!job) throw new NotFoundException(`Verification job ${jobId} not found`);
    if (job.operatorId !== operatorId) throw new ForbiddenException('not your job');
    if (job.status !== 'claimed') {
      throw new BadRequestException(`job is ${job.status}, expected claimed`);
    }

    const operatorPoint = medianPoint(input.artefacts);
    const mismatchM = operatorPoint
      ? haversineMetres(operatorPoint, { lat: job.listing.lat, lng: job.listing.lng })
      : null;
    if (mismatchM !== null && mismatchM > GPS_MISMATCH_THRESHOLD_M) {
      this.logger.warn(
        `Verification ${jobId}: GPS mismatch ${mismatchM.toFixed(0)}m (> ${GPS_MISMATCH_THRESHOLD_M})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.verificationArtefact.createMany({
        data: input.artefacts.map((a) => ({
          jobId,
          kind: a.kind,
          url: a.url,
          capturedAt: new Date(a.capturedAt),
          lat: a.lat,
          lng: a.lng,
        })),
      });
      return tx.verificationJob.update({
        where: { id: jobId },
        data: { status: 'submitted', gpsMismatchMetres: mismatchM },
      });
    });
  }

  async approve(jobId: string): Promise<VerificationJob> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.verificationJob.findUnique({
        where: { id: jobId },
        include: { listing: true },
      });
      if (!job) throw new NotFoundException(`Verification job ${jobId} not found`);
      if (job.status !== 'submitted') {
        throw new BadRequestException(`job is ${job.status}, expected submitted`);
      }
      const now = new Date();
      await tx.listing.update({
        where: { id: job.listingId },
        data: { status: 'active', verifiedAt: now },
      });
      return tx.verificationJob.update({
        where: { id: jobId },
        data: { status: 'approved', decidedAt: now, decisionReason: null },
      });
    });
  }

  async reject(jobId: string, reason: string): Promise<VerificationJob> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.verificationJob.findUnique({ where: { id: jobId } });
      if (!job) throw new NotFoundException(`Verification job ${jobId} not found`);
      if (job.status !== 'submitted') {
        throw new BadRequestException(`job is ${job.status}, expected submitted`);
      }
      const now = new Date();
      await tx.listing.update({
        where: { id: job.listingId },
        data: { status: 'rejected' },
      });
      return tx.verificationJob.update({
        where: { id: jobId },
        data: { status: 'rejected', decidedAt: now, decisionReason: reason },
      });
    });
  }
}

function medianPoint(
  artefacts: { lat: number | null; lng: number | null }[],
): { lat: number; lng: number } | null {
  const points = artefacts.filter(
    (a): a is { lat: number; lng: number } => a.lat !== null && a.lng !== null,
  );
  if (points.length === 0) return null;
  const lats = [...points.map((p) => p.lat)].sort((a, b) => a - b);
  const lngs = [...points.map((p) => p.lng)].sort((a, b) => a - b);
  const mid = Math.floor(points.length / 2);
  return { lat: lats[mid]!, lng: lngs[mid]! };
}
