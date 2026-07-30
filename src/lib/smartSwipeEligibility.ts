/**
 * Smart Swipe eligibility — catalog-first.
 *
 * Basic recommendations need ≥2 cards and a real recommendation payload.
 * Transaction history is NOT required (optional automation can refine later).
 */

import type { SmartSwipeRecommendation } from '@/types/dashboard';

export const SMART_SWIPE_MIN_CARDS = 2;
/** @deprecated Kept for txn-count helpers; no longer gates catalog Smart Swipe. */
export const SMART_SWIPE_MIN_TXNS_30D = 5;
export const SMART_SWIPE_LOOKBACK_DAYS = 30;

export type SmartSwipeEligibilityInput = {
  cardCount: number;
  /** Ignored for catalog-first eligibility; retained for API compatibility. */
  recentConfirmedTxnCount?: number;
  recommendation: SmartSwipeRecommendation | null;
};

export type SmartSwipeEligibility = {
  /** Enough cards to choose between. */
  signalReady: boolean;
  hasRecommendation: boolean;
  /** Home shows Smart Swipe when both are true. */
  showSmartSwipe: boolean;
};

export function deriveSmartSwipeEligibility(
  input: SmartSwipeEligibilityInput,
): SmartSwipeEligibility {
  const signalReady = input.cardCount >= SMART_SWIPE_MIN_CARDS;
  const hasRecommendation = input.recommendation != null;
  return {
    signalReady,
    hasRecommendation,
    showSmartSwipe: signalReady && hasRecommendation,
  };
}

/** Count confirmed txns whose transaction_date is within the lookback window. */
export function countRecentConfirmedTxns(
  txns: Array<{ status: string; transactionDate: string }>,
  nowMs: number = Date.now(),
  lookbackDays: number = SMART_SWIPE_LOOKBACK_DAYS,
): number {
  const cutoff = nowMs - lookbackDays * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const t of txns) {
    if (t.status !== 'confirmed') continue;
    const ts = new Date(t.transactionDate).getTime();
    if (Number.isFinite(ts) && ts >= cutoff) n += 1;
  }
  return n;
}
