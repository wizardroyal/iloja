import { CredibilityService } from './credibility.service';

describe('CredibilityService.tierForScore', () => {
  it('keeps a brand-new account at "new_tier"', () => {
    expect(CredibilityService.tierForScore(0, 0)).toBe('new_tier');
  });

  it('promotes to silver at 4.0', () => {
    expect(CredibilityService.tierForScore(4.0, 5)).toBe('silver');
  });

  it('promotes to gold at 4.5', () => {
    expect(CredibilityService.tierForScore(4.5, 30)).toBe('gold');
    expect(CredibilityService.tierForScore(4.6, 30)).toBe('gold');
  });

  it('reaches diamond at 4.8', () => {
    expect(CredibilityService.tierForScore(4.8, 100)).toBe('diamond');
    expect(CredibilityService.tierForScore(5.0, 100)).toBe('diamond');
  });

  it('drops to blue at any positive score with no track record', () => {
    expect(CredibilityService.tierForScore(2.5, 0)).toBe('blue');
  });
});
