import { feePaybackPresentation } from './feePayback';

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

describe('feePaybackPresentation', () => {
  it.each([
    { fee: 500, value: 0, headline: '0%', progress: 0 },
    { fee: 12500, value: 8240, headline: '66%', progress: 0.6592 },
    { fee: 5000, value: 5000, headline: '100%', progress: 1 },
    { fee: 1000, value: 2500, headline: '2.5×', progress: 1 },
    { fee: 9999999, value: 12345678, headline: '123%', progress: 1 },
  ])(
    'handles fee=$fee and value=$value',
    ({ fee, value, headline, progress }) => {
      const result = feePaybackPresentation(fee, value, money);
      expect(result.headline).toBe(headline);
      expect(result.progress).toBeCloseTo(progress);
      expect(result.summary).not.toMatch(/NaN|Infinity/);
    },
  );

  it('handles a zero annual fee without division artifacts', () => {
    const result = feePaybackPresentation(0, 1000, money);
    expect(result.headline).toBe('No fee');
    expect(result.progress).toBe(0);
    expect(result.summary).toContain('no annual fee');
  });

  it('clamps invalid and negative values', () => {
    expect(feePaybackPresentation(-1, Number.NaN, money)).toMatchObject({
      safeFee: 0,
      benefitValue: 0,
      progress: 0,
    });
  });
});
