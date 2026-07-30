import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  annualizeBenefitValue,
  normalizeExtractionBenefits,
} from './annualizeBenefits.js';

describe('annualizeBenefitValue', () => {
  it('annualizes Axis Neo Zomato ₹120 × 2/month → ₹2880/year', () => {
    const out = annualizeBenefitValue({
      title: 'Discount on Zomato',
      category: 'dining',
      description:
        'Flat ₹120 off on food delivery with a minimum spend of ₹499, valid two times per month.',
      value_estimate: 240,
    });
    assert.equal(out.value_estimate, 2880);
    assert.match(out.period_raw ?? '', /month/i);
  });

  it('annualizes a plain monthly cap', () => {
    const out = annualizeBenefitValue({
      title: 'Cashback',
      category: 'shopping',
      description: 'Capped at ₹400 per month across partners.',
      value_estimate: 400,
    });
    assert.equal(out.value_estimate, 4800);
    assert.equal(out.period_raw, '₹400/month');
  });

  it('annualizes quarterly caps', () => {
    const out = annualizeBenefitValue({
      title: 'Flipkart cashback',
      category: 'shopping',
      description: 'Capped at ₹4000 per statement quarter.',
      value_estimate: 4000,
    });
    assert.equal(out.value_estimate, 16000);
  });

  it('leaves already-annual values alone', () => {
    const out = annualizeBenefitValue({
      title: 'Blinkit',
      category: 'shopping',
      description: 'Up to ₹250 off once per month.',
      value_estimate: 3000,
    });
    assert.equal(out.value_estimate, 3000);
  });

  it('does not annualize one-time activation benefits', () => {
    const out = annualizeBenefitValue({
      title: 'Activation',
      category: 'other',
      description:
        '100% cashback up to ₹300 on first utility bill within first 30 days.',
      value_estimate: 300,
    });
    assert.equal(out.value_estimate, 300);
  });
});

describe('normalizeExtractionBenefits fee sanity', () => {
  it('flags a benefit >10× annual fee', () => {
    const r = normalizeExtractionBenefits(
      [
        {
          title: 'Huge',
          category: 'other',
          description: 'Something',
          value_estimate: 5000,
        },
      ],
      250,
    );
    assert.equal(r.implausibleVsFee, true);
    assert.equal(r.flags.length, 1);
  });
});
