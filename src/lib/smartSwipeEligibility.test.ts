/**
 * Smart Swipe eligibility — Home shows recommendation only when signal + payload exist.
 */

import {
  SMART_SWIPE_MIN_CARDS,
  SMART_SWIPE_MIN_TXNS_30D,
  countRecentConfirmedTxns,
  deriveSmartSwipeEligibility,
} from './smartSwipeEligibility';
import type { SmartSwipeRecommendation } from '@/types/dashboard';

const rec: SmartSwipeRecommendation = {
  category: 'Dining',
  cardName: 'Axis Ace',
  rewardValue: '5×',
  rewardLabel: 'points',
};

describe('deriveSmartSwipeEligibility', () => {
  it('shows carousel (not Smart Swipe) when recommendation is null even with signal', () => {
    const e = deriveSmartSwipeEligibility({
      cardCount: 4,
      recentConfirmedTxnCount: 20,
      recommendation: null,
    });
    expect(e.signalReady).toBe(true);
    expect(e.hasRecommendation).toBe(false);
    expect(e.showSmartSwipe).toBe(false);
  });

  it('shows carousel when under card or txn thresholds despite a recommendation', () => {
    expect(
      deriveSmartSwipeEligibility({
        cardCount: 1,
        recentConfirmedTxnCount: 20,
        recommendation: rec,
      }).showSmartSwipe,
    ).toBe(false);
    expect(
      deriveSmartSwipeEligibility({
        cardCount: 3,
        recentConfirmedTxnCount: SMART_SWIPE_MIN_TXNS_30D - 1,
        recommendation: rec,
      }).showSmartSwipe,
    ).toBe(false);
  });

  it('shows Smart Swipe when ≥2 cards, ≥5 recent txns, and a real recommendation', () => {
    const e = deriveSmartSwipeEligibility({
      cardCount: SMART_SWIPE_MIN_CARDS,
      recentConfirmedTxnCount: SMART_SWIPE_MIN_TXNS_30D,
      recommendation: rec,
    });
    expect(e.signalReady).toBe(true);
    expect(e.hasRecommendation).toBe(true);
    expect(e.showSmartSwipe).toBe(true);
  });

  it('re-evaluates cleanly when signal crosses the threshold (no sticky carousel)', () => {
    const before = deriveSmartSwipeEligibility({
      cardCount: 1,
      recentConfirmedTxnCount: 2,
      recommendation: null,
    });
    expect(before.showSmartSwipe).toBe(false);

    const after = deriveSmartSwipeEligibility({
      cardCount: 3,
      recentConfirmedTxnCount: 8,
      recommendation: rec,
    });
    expect(after.showSmartSwipe).toBe(true);
  });
});

describe('countRecentConfirmedTxns', () => {
  const now = Date.parse('2026-07-26T12:00:00.000Z');

  it('counts only confirmed txns inside the 30-day window', () => {
    const n = countRecentConfirmedTxns(
      [
        { status: 'confirmed', transactionDate: '2026-07-20' },
        { status: 'confirmed', transactionDate: '2026-06-01' },
        { status: 'pending', transactionDate: '2026-07-25' },
        { status: 'confirmed', transactionDate: '2026-07-10' },
      ],
      now,
    );
    expect(n).toBe(2);
  });
});
