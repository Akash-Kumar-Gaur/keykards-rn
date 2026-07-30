/**
 * Smart Swipe eligibility — catalog-first (no txn gate).
 */

import {
  SMART_SWIPE_MIN_CARDS,
  countRecentConfirmedTxns,
  deriveSmartSwipeEligibility,
} from './smartSwipeEligibility';
import type { SmartSwipeRecommendation } from '@/types/dashboard';

const rec: SmartSwipeRecommendation = {
  category: 'Dining',
  cardName: 'Axis Ace',
  rewardValue: '5%',
  rewardLabel: 'Cashback',
};

describe('deriveSmartSwipeEligibility', () => {
  it('shows carousel when recommendation is null even with 2+ cards', () => {
    const e = deriveSmartSwipeEligibility({
      cardCount: 4,
      recentConfirmedTxnCount: 0,
      recommendation: null,
    });
    expect(e.signalReady).toBe(true);
    expect(e.hasRecommendation).toBe(false);
    expect(e.showSmartSwipe).toBe(false);
  });

  it('shows Smart Swipe with ≥2 cards and a recommendation — zero txns', () => {
    const e = deriveSmartSwipeEligibility({
      cardCount: SMART_SWIPE_MIN_CARDS,
      recentConfirmedTxnCount: 0,
      recommendation: rec,
    });
    expect(e.signalReady).toBe(true);
    expect(e.hasRecommendation).toBe(true);
    expect(e.showSmartSwipe).toBe(true);
  });

  it('hides Smart Swipe with only one card', () => {
    expect(
      deriveSmartSwipeEligibility({
        cardCount: 1,
        recentConfirmedTxnCount: 20,
        recommendation: rec,
      }).showSmartSwipe,
    ).toBe(false);
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
