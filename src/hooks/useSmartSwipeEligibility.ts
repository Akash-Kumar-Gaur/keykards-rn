/**
 * useSmartSwipeEligibility — Home layout gate for Smart Swipe vs card carousel.
 */

import { useMemo } from 'react';
import {
  deriveSmartSwipeEligibility,
  type SmartSwipeEligibility,
} from '@/lib/smartSwipeEligibility';
import type { SmartSwipeRecommendation } from '@/types/dashboard';

export function useSmartSwipeEligibility(input: {
  cardCount: number;
  recentConfirmedTxnCount: number;
  recommendation: SmartSwipeRecommendation | null;
}): SmartSwipeEligibility {
  const { cardCount, recentConfirmedTxnCount, recommendation } = input;
  return useMemo(
    () =>
      deriveSmartSwipeEligibility({
        cardCount,
        recentConfirmedTxnCount,
        recommendation,
      }),
    [cardCount, recentConfirmedTxnCount, recommendation],
  );
}
