import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';

/**
 * Unit-tests AuthService against a hand-rolled in-memory Prisma fake.
 * Avoids the cost of standing up a real DB per test while still exercising
 * the multi-step state changes (challenge issued → consumed → user minted).
 */
function makeFakePrisma() {
  type Challenge = {
    id: string;
    phone: string;
    codeHash: string;
    salt: string;
    providerRef: string | null;
    attempts: number;
    expiresAt: Date;
    consumedAt: Date | null;
    createdAt: Date;
  };
  type User = {
    id: string;
    phone: string;
    email: string | null;
    fullName: string;
    roles: string[];
  };

  const challenges: Challenge[] = [];
  const users: User[] = [];
  let nextId = 1;

  return {
    challenges,
    users,
    otpChallenge: {
      create: async ({ data }: { data: Omit<Challenge, 'id' | 'attempts' | 'consumedAt' | 'createdAt'> }) => {
        const c: Challenge = {
          ...data,
          id: `c${nextId++}`,
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(),
        };
        challenges.unshift(c);
        return c;
      },
      findFirst: async ({ where }: { where: { phone: string; consumedAt: null; expiresAt: { gt: Date } } }) => {
        return (
          challenges.find(
            (c) =>
              c.phone === where.phone &&
              c.consumedAt === null &&
              c.expiresAt.getTime() > where.expiresAt.gt.getTime(),
          ) ?? null
        );
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const c = challenges.find((x) => x.id === where.id);
        if (!c) throw new Error('not found');
        if (typeof data.attempts === 'object' && data.attempts && 'increment' in (data.attempts as object)) {
          c.attempts += (data.attempts as { increment: number }).increment;
        }
        if (data.consumedAt instanceof Date) c.consumedAt = data.consumedAt;
        return c;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { phone: string } }) =>
        users.find((u) => u.phone === where.phone) ?? null,
      create: async ({ data }: { data: Omit<User, 'id' | 'email'> & { email?: string | null } }) => {
        const u: User = { id: `u${nextId++}`, email: data.email ?? null, ...data };
        users.push(u);
        return u;
      },
    },
  };
}

function makeFakeOtp() {
  return {
    send: jest.fn(async () => ({ pinId: 'pin-1', expiresAt: new Date().toISOString() })),
  };
}

const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });

describe('AuthService', () => {
  it('issues a token and creates a user on first verify', async () => {
    const prisma = makeFakePrisma();
    const otp = makeFakeOtp();
    const svc = new AuthService(prisma as never, jwt, otp as never);

    await svc.requestOtp('+2348012345678');
    expect(otp.send).toHaveBeenCalledWith(expect.objectContaining({ phone: '+2348012345678' }));
    const challenge = prisma.challenges[0]!;
    // Reverse-engineer the plaintext code via the hash so we can pass it to verify.
    const code = findMatchingCode(challenge.codeHash, challenge.salt);

    const result = await svc.verifyOtp('+2348012345678', code, 'Adaeze Okafor');
    expect(result.token).toBeTruthy();
    expect(prisma.users).toHaveLength(1);
    expect(prisma.users[0]!.fullName).toBe('Adaeze Okafor');
    expect(prisma.challenges[0]!.consumedAt).toBeInstanceOf(Date);
  });

  it('rejects an invalid code and increments attempts', async () => {
    const prisma = makeFakePrisma();
    const svc = new AuthService(prisma as never, jwt, makeFakeOtp() as never);
    await svc.requestOtp('+2348012345678');

    await expect(svc.verifyOtp('+2348012345678', '000000', 'X')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.challenges[0]!.attempts).toBe(1);
  });

  it('rejects re-use of a consumed challenge', async () => {
    const prisma = makeFakePrisma();
    const svc = new AuthService(prisma as never, jwt, makeFakeOtp() as never);
    await svc.requestOtp('+2348012345678');
    const code = findMatchingCode(prisma.challenges[0]!.codeHash, prisma.challenges[0]!.salt);
    await svc.verifyOtp('+2348012345678', code, 'X');

    await expect(svc.verifyOtp('+2348012345678', code, 'X')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('requires fullName for first-time signup', async () => {
    const prisma = makeFakePrisma();
    const svc = new AuthService(prisma as never, jwt, makeFakeOtp() as never);
    await svc.requestOtp('+2348012345678');
    const code = findMatchingCode(prisma.challenges[0]!.codeHash, prisma.challenges[0]!.salt);

    await expect(svc.verifyOtp('+2348012345678', code)).rejects.toBeInstanceOf(BadRequestException);
  });
});

function findMatchingCode(targetHash: string, salt: string): string {
  // Brute force the 6-digit space — fast (~1M ops at most).
  for (let n = 0; n < 1_000_000; n++) {
    const code = String(n).padStart(6, '0');
    if (createHash('sha256').update(`${salt}:${code}`).digest('hex') === targetHash) {
      return code;
    }
  }
  throw new Error('test bug: could not reverse the OTP hash');
}
