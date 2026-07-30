import {
  isPurchaseProtectionBenefit,
  parseLoungeVisitsPerYear,
  scoreBenefitRewardRate,
} from './catalogBenefitParse';
import {
  pickDefaultSmartSwipeCategory,
  recommendCatalogSmartSwipe,
} from './catalogSmartSwipe';
import {
  computeLoungeSummary,
  computePortfolioFeeValue,
  computePortfolioInsights,
  detectBenefitOverlaps,
} from './portfolioInsights';
import { deriveSmartSwipeEligibility } from './smartSwipeEligibility';

describe('parseLoungeVisitsPerYear', () => {
  it('parses quarterly visits into annual', () => {
    expect(
      parseLoungeVisitsPerYear({
        title: 'Domestic Airport Lounge Access',
        category: 'lounge',
        description: '2 complimentary domestic airport lounge visits per quarter (8/year).',
      }),
    ).toBe(8);
  });

  it('parses explicit per-year visits', () => {
    expect(
      parseLoungeVisitsPerYear({
        title: 'Priority Pass',
        category: 'lounge',
        description: '6 complimentary international lounge visits per year via Priority Pass',
      }),
    ).toBe(6);
  });
});

describe('scoreBenefitRewardRate', () => {
  it('scores pts per rupee but displays the benefit fact', () => {
    const s = scoreBenefitRewardRate({
      title: '4 Reward Points per ₹150 Spent',
      category: 'shopping',
      description: 'Earn 4 reward points on every ₹150 of retail spend.',
    });
    expect(s?.benefitFact).toContain('4 Reward Points');
    expect(s!.score).toBeCloseTo((4 / 150) * 100);
  });

  it('scores cashback percent with title as fact', () => {
    const s = scoreBenefitRewardRate({
      title: '5% cashback on dining',
      category: 'dining',
    });
    expect(s?.benefitFact).toBe('5% cashback on dining');
  });
});

describe('recommendCatalogSmartSwipe', () => {
  const cards = [
    {
      id: 'a',
      nickname: 'Regalia',
      benefits: [
        {
          title: '4 Reward Points per ₹150 Spent',
          category: 'shopping' as const,
          description: '4 pts/₹150',
        },
        {
          title: 'Domestic Lounge',
          category: 'lounge' as const,
          description: '2 visits per quarter (8/year)',
        },
      ],
    },
    {
      id: 'b',
      nickname: 'Ace',
      benefits: [
        {
          title: '5% cashback on dining',
          category: 'dining' as const,
        },
        {
          title: '2% cashback everywhere',
          category: 'shopping' as const,
        },
      ],
    },
  ];

  it('recommends with 2 cards and zero transactions', () => {
    const rec = recommendCatalogSmartSwipe({ cards, category: 'dining' });
    expect(rec).not.toBeNull();
    expect(rec!.cardName).toBe('Ace');
    expect(rec!.category).toBe('Dining');
  });

  it('picks higher shopping rate', () => {
    const rec = recommendCatalogSmartSwipe({ cards, category: 'shopping' });
    expect(rec).not.toBeNull();
    // 2% cashback scores higher than 4/150 pts
    expect(rec!.cardName).toBe('Ace');
  });

  it('returns null with a single card', () => {
    expect(
      recommendCatalogSmartSwipe({ cards: cards.slice(0, 1), category: 'dining' }),
    ).toBeNull();
  });
});

describe('deriveSmartSwipeEligibility catalog-first', () => {
  it('shows Smart Swipe with 2 cards and a recommendation, zero txns', () => {
    const e = deriveSmartSwipeEligibility({
      cardCount: 2,
      recentConfirmedTxnCount: 0,
      recommendation: {
        category: 'Dining',
        cardName: 'Ace',
        rewardValue: '5%',
        rewardLabel: 'Cashback',
      },
    });
    expect(e.signalReady).toBe(true);
    expect(e.showSmartSwipe).toBe(true);
  });

  it('hides Smart Swipe with only one card', () => {
    expect(
      deriveSmartSwipeEligibility({
        cardCount: 1,
        recommendation: {
          category: 'Dining',
          cardName: 'Ace',
          rewardValue: '5%',
          rewardLabel: 'Cashback',
        },
      }).showSmartSwipe,
    ).toBe(false);
  });
});

describe('portfolio insights', () => {
  const cards = [
    {
      id: '1',
      nickname: 'Regalia',
      annualFee: 2500,
      benefits: [
        {
          title: 'Domestic Airport Lounge Access',
          category: 'lounge' as const,
          description: '2 visits per quarter (8/year)',
          valueEstimate: null,
        },
        {
          title: 'Purchase Protection Cover',
          category: 'other' as const,
          description: 'Purchase protection up to ₹50,000',
          valueEstimate: 500,
        },
      ],
    },
    {
      id: '2',
      nickname: 'Millennia',
      annualFee: 1000,
      benefits: [
        {
          title: 'Domestic Airport Lounge Access',
          category: 'lounge' as const,
          description: '1 visit per quarter (4/year)',
          valueEstimate: null,
        },
        {
          title: 'Swiggy One',
          category: 'dining' as const,
          valueEstimate: 1299,
        },
      ],
    },
  ];

  it('counts cards with lounge benefits (no invented visit totals)', () => {
    const lounge = computeLoungeSummary(cards);
    expect(lounge?.cardsWithLounge).toBe(2);
    expect(lounge?.lines.length).toBe(2);
    expect(lounge?.totalVisitsPerYear).toBe(0);
  });

  it('flags overlapping lounge benefits', () => {
    const overlaps = detectBenefitOverlaps(cards);
    expect(overlaps.some((o) => o.category === 'lounge')).toBe(true);
  });

  it('fee helper only sums user annual fees — not benefit value_estimate', () => {
    const fv = computePortfolioFeeValue(cards);
    expect(fv?.totalFees).toBe(3500);
    expect(fv?.totalBenefitValue).toBe(0);
  });

  it('portfolio insights omit feeValue for display', () => {
    const insights = computePortfolioInsights(cards);
    expect(insights.feeValue).toBeNull();
  });

  it('detects purchase protection benefits', () => {
    expect(isPurchaseProtectionBenefit(cards[0]!.benefits[1]!)).toBe(true);
  });
});

describe('pickDefaultSmartSwipeCategory', () => {
  it('returns a category present on the cards', () => {
    const cat = pickDefaultSmartSwipeCategory([
      {
        id: '1',
        nickname: 'A',
        benefits: [{ title: 'Fuel waiver', category: 'fuel' }],
      },
      {
        id: '2',
        nickname: 'B',
        benefits: [{ title: 'Dining', category: 'dining' }],
      },
    ]);
    expect(['fuel', 'dining']).toContain(cat);
  });
});
