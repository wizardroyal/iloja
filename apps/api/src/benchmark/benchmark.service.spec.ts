import { BenchmarkService } from './benchmark.service';

function fakePrisma(prices: bigint[]) {
  return {
    listing: {
      findMany: jest.fn(async () => prices.map((priceKobo) => ({ priceKobo }))),
    },
  };
}

describe('BenchmarkService.benchmark', () => {
  it('returns nulls when there are no listings', async () => {
    const svc = new BenchmarkService(fakePrisma([]) as never);
    const r = await svc.benchmark({ type: 'long_term', neighborhood: 'Yaba' });
    expect(r.sampleSize).toBe(0);
    expect(r.medianKobo).toBeNull();
  });

  it('orders results so p25 <= median <= p75', async () => {
    const prices = [
      BigInt(60_000_000),
      BigInt(85_000_000),
      BigInt(120_000_000),
      BigInt(150_000_000),
      BigInt(200_000_000),
    ];
    const svc = new BenchmarkService(fakePrisma(prices) as never);
    const r = await svc.benchmark({ type: 'long_term', neighborhood: 'Yaba' });
    expect(r.sampleSize).toBe(5);
    const p25 = BigInt(r.p25Kobo!);
    const median = BigInt(r.medianKobo!);
    const p75 = BigInt(r.p75Kobo!);
    expect(p25).toBeLessThanOrEqual(median);
    expect(median).toBeLessThanOrEqual(p75);
    expect(median).toBe(BigInt(120_000_000));
  });
});
