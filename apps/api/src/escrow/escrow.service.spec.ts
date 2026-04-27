import { inspectionFeeFor } from './escrow.service';

/**
 * Escrow state-machine integration tests will land alongside Prisma test
 * harness work. For now we lock down the inspection-fee pricing rule —
 * easy to break, central to the renter experience, and the sole place we
 * choose absolute Naira amounts.
 */
describe('inspectionFeeFor', () => {
  it('returns the ₦5,000 floor for tiny listings', () => {
    // ₦100,000 listing → 1% would be ₦1,000, well under the floor.
    const fee = inspectionFeeFor(BigInt(100_000_00));
    expect(fee).toBe(BigInt(500_000)); // ₦5,000
  });

  it('returns the ₦25,000 ceiling for big listings', () => {
    // ₦10M listing → 1% would be ₦100,000, well over the ceiling.
    const fee = inspectionFeeFor(BigInt(10_000_000_00));
    expect(fee).toBe(BigInt(2_500_000)); // ₦25,000
  });

  it('returns 1% of the listing price in the typical band', () => {
    // ₦1.2M annual rent — typical Lagos long-term — should yield ₦12,000.
    const fee = inspectionFeeFor(BigInt(1_200_000_00));
    expect(fee).toBe(BigInt(12_000_00));
  });
});
