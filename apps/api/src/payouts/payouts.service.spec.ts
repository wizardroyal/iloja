import type { Payout, UserBankAccount } from '@prisma/client';
import { PayoutsService } from './payouts.service';

function makeFakePrisma() {
  const payouts: Payout[] = [];
  const banks = new Map<string, UserBankAccount>();
  let id = 1;
  return {
    payouts,
    banks,
    payout: {
      findFirst: async ({
        where,
      }: {
        where: { contextRef?: string; kind?: string };
      }) =>
        payouts.find(
          (p) =>
            (where.contextRef === undefined || p.contextRef === where.contextRef) &&
            (where.kind === undefined || p.kind === where.kind),
        ) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        payouts.find((p) => p.id === where.id) ?? null,
      create: async ({
        data,
      }: {
        data: Omit<Payout, 'id' | 'createdAt' | 'settledAt' | 'providerRef' | 'failureReason'>;
      }) => {
        const p: Payout = {
          ...data,
          id: `p${id++}`,
          createdAt: new Date(),
          settledAt: null,
          providerRef: null,
          failureReason: null,
        } as Payout;
        payouts.push(p);
        return p;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Payout>;
      }) => {
        const p = payouts.find((x) => x.id === where.id);
        if (!p) throw new Error('not found');
        Object.assign(p, data);
        return p;
      },
    },
    userBankAccount: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        banks.get(where.userId) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId: string };
        create: Omit<UserBankAccount, 'id' | 'createdAt' | 'updatedAt' | 'verifiedAt'>;
        update: Partial<UserBankAccount>;
      }) => {
        const existing = banks.get(where.userId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const b: UserBankAccount = {
          ...create,
          id: `b${id++}`,
          verifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as UserBankAccount;
        banks.set(where.userId, b);
        return b;
      },
    },
  };
}

const payments = {
  payout: jest.fn(async () => ({ providerRef: 'paystack-xfer-1', status: 'success' as const, reference: 'r' })),
  initiateCollection: jest.fn(),
  verifyCollection: jest.fn(),
  verifyWebhookSignature: jest.fn(),
};

describe('PayoutsService', () => {
  beforeEach(() => payments.payout.mockClear());

  it('queueForVerification is idempotent on contextRef', async () => {
    const prisma = makeFakePrisma();
    const svc = new PayoutsService(prisma as never, payments as never);
    const a = await svc.queueForVerification({
      operatorId: 'op1',
      verificationJobId: 'job1',
    });
    const b = await svc.queueForVerification({
      operatorId: 'op1',
      verificationJobId: 'job1',
    });
    expect(a?.id).toBe(b?.id);
    expect(prisma.payouts).toHaveLength(1);
  });

  it('dispatch succeeds when bank account exists and provider returns success', async () => {
    const prisma = makeFakePrisma();
    const svc = new PayoutsService(prisma as never, payments as never);
    await svc.setBankAccount('op1', {
      bankCode: '058',
      accountNumber: '0123456789',
      accountName: 'Operator One',
    });
    const queued = await svc.queueForVerification({
      operatorId: 'op1',
      verificationJobId: 'job1',
    });
    const result = await svc.dispatch(queued!.id);
    expect(result.status).toBe('succeeded');
    expect(payments.payout).toHaveBeenCalledTimes(1);
  });

  it('dispatch leaves status queued when no bank account on file', async () => {
    const prisma = makeFakePrisma();
    const svc = new PayoutsService(prisma as never, payments as never);
    const queued = await svc.queueForVerification({
      operatorId: 'op1',
      verificationJobId: 'job1',
    });
    const result = await svc.dispatch(queued!.id);
    expect(result.status).toBe('queued');
    expect(payments.payout).not.toHaveBeenCalled();
  });

  it('dispatch on already-succeeded payout is a no-op', async () => {
    const prisma = makeFakePrisma();
    const svc = new PayoutsService(prisma as never, payments as never);
    await svc.setBankAccount('op1', {
      bankCode: '058',
      accountNumber: '0123456789',
      accountName: 'Operator One',
    });
    const queued = await svc.queueForVerification({
      operatorId: 'op1',
      verificationJobId: 'job1',
    });
    await svc.dispatch(queued!.id);
    payments.payout.mockClear();
    await svc.dispatch(queued!.id);
    expect(payments.payout).not.toHaveBeenCalled();
  });
});
