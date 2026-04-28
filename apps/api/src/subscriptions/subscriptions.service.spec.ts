import { SubscriptionsService } from './subscriptions.service';

function makeFakePrisma(rows: { id: string; status: string; currentPeriodEnd: Date }[]) {
  return {
    subscription: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { status: string; currentPeriodEnd: { lt: Date } };
        data: { status: string };
      }) => {
        let count = 0;
        for (const r of rows) {
          if (r.status === where.status && r.currentPeriodEnd < where.currentPeriodEnd.lt) {
            r.status = data.status;
            count += 1;
          }
        }
        return { count };
      },
    },
  };
}

const payments = {
  initiateCollection: jest.fn(),
  payout: jest.fn(),
  verifyCollection: jest.fn(),
  verifyWebhookSignature: jest.fn(),
};

describe('SubscriptionsService.sweepExpired', () => {
  it('flips past-period actives to expired and leaves the rest alone', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const rows = [
      { id: 's1', status: 'active', currentPeriodEnd: past },
      { id: 's2', status: 'active', currentPeriodEnd: future },
      { id: 's3', status: 'cancelled', currentPeriodEnd: past },
    ];
    const svc = new SubscriptionsService(makeFakePrisma(rows) as never, payments as never);
    const result = await svc.sweepExpired();
    expect(result.expired).toBe(1);
    expect(rows.find((r) => r.id === 's1')!.status).toBe('expired');
    expect(rows.find((r) => r.id === 's2')!.status).toBe('active');
    expect(rows.find((r) => r.id === 's3')!.status).toBe('cancelled');
  });
});
