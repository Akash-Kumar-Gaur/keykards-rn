/**
 * Smart Swipe eligibility — single source of truth for Home layout branching.
 *
 * Optimize (Phase 4) is not wired yet: `smartSwipe` stays null until a real
 * recommendation exists. Home therefore shows the card carousel until BOTH
 * signal thresholds AND a non-null recommendation are present — so users never
 * sit on a disabled/empty Smart Swipe panel.
 *
 * Thresholds (chosen for a non-trivial Optimize suggestion; no prior constants
 * existed in-repo because the recommender is still a stub):
 *   - ≥ 2 cards (need a choice between cards)
 *   - ≥ 5 confirmed transactions in the last 30 days (enough spend signal)
 */

import type { SmartSwipeRecommendation } from '@/types/dashboard';

export const SMART_SWIPE_MIN_CARDS = 2;
export const SMART_SWIPE_MIN_TXNS_30D = 5;
export const SMART_SWIPE_LOOKBACK_DAYS = 30;

export type SmartSwipeEligibilityInput = {
  cardCount: number;
  /** Confirmed transactions with transaction_date within the lookback window. */
  recentConfirmedTxnCount: number;
  recommendation: SmartSwipeRecommendation | null;
};

export type SmartSwipeEligibility = {
  /** Account has enough cards + recent spend for Optimize to matter. */
  signalReady: boolean;
  /** Optimize produced a concrete recommendation payload. */
  hasRecommendation: boolean;
  /**
   * Home shows Smart Swipe (vs the Your cards carousel) only when both are true.
   * Re-evaluates on every dashboard load — no sticky carousel once eligible.
   */
  showSmartSwipe: boolean;
};

export function deriveSmartSwipeEligibility(
  input: SmartSwipeEligibilityInput,
): SmartSwipeEligibility {
  const signalReady =
    input.cardCount >= SMART_SWIPE_MIN_CARDS &&
    input.recentConfirmedTxnCount >= SMART_SWIPE_MIN_TXNS_30D;
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
