import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { OTP_PROVIDER, type OtpProvider } from '../providers/otp/otp.provider';
import { PrismaService } from '../prisma/prisma.service';

/** OTP TTL — 5 minutes is the doc-recommended balance for Nigerian carriers. */
const OTP_TTL_SECONDS = 300;
/** Max verify attempts per challenge before it's invalidated. */
const MAX_OTP_ATTEMPTS = 5;

export interface SessionPayload {
  sub: string;
  phone: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
  ) {}

  async requestOtp(phone: string): Promise<{ pinId: string; expiresAt: string }> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(16).toString('hex');
    const codeHash = hash(code, salt);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    // Send first — if the provider rejects we don't want a stale row sitting
    // in the table.
    const sendResult = await this.otp.send({ phone, ttlSeconds: OTP_TTL_SECONDS });

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phone,
        codeHash,
        salt,
        providerRef: sendResult.pinId,
        expiresAt,
      },
    });

    // Dev convenience: log the code when the null provider is in use so
    // testers can complete the flow without a real SMS. Stripped at log
    // shipping in prod.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(`DEV-ONLY OTP for ${phone}: ${code}`);
    }

    return { pinId: challenge.id, expiresAt: challenge.expiresAt.toISOString() };
  }

  async verifyOtp(
    phone: string,
    code: string,
    fullName?: string,
  ): Promise<{ token: string; userId: string }> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new UnauthorizedException('no active OTP for this phone');
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException('too many failed attempts');
    }

    const expected = hash(code, challenge.salt);
    if (expected !== challenge.codeHash) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('invalid code');
    }

    // Single-use: mark consumed before issuing a token. Replays of the same
    // code never produce a new session.
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      if (!fullName) {
        throw new BadRequestException('fullName required for first-time signup');
      }
      user = await this.prisma.user.create({
        data: {
          phone,
          fullName,
          roles: ['renter'],
        },
      });
    }

    const payload: SessionPayload = {
      sub: user.id,
      phone: user.phone,
      roles: user.roles,
    };
    const token = await this.jwt.signAsync(payload);
    return { token, userId: user.id };
  }
}

function hash(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}
