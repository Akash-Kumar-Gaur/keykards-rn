/**
 * Benefit category → icon + tone, shared across the Card Detail benefits UI.
 */

import type { Ionicons } from '@expo/vector-icons';
import type { BadgeTone } from '@/components/ui/IconBadge';
import type { BenefitCategory } from '@/types/card';

type IconName = keyof typeof Ionicons.glyphMap;

export const BENEFIT_CATEGORY_META: Record<
  BenefitCategory,
  { icon: IconName; tone: BadgeTone; label: string }
> = {
  lounge: { icon: 'cafe-outline', tone: 'indigo', label: 'Lounge' },
  dining: { icon: 'restaurant-outline', tone: 'amber', label: 'Dining' },
  travel: { icon: 'airplane-outline', tone: 'indigo', label: 'Travel' },
  shopping: { icon: 'cart-outline', tone: 'green', label: 'Shopping' },
  fuel: { icon: 'car-outline', tone: 'amber', label: 'Fuel' },
  entertainment: { icon: 'film-outline', tone: 'indigo', label: 'Entertainment' },
  other: { icon: 'sparkles-outline', tone: 'indigo', label: 'Other' },
};

export function categoryMeta(category: string) {
  return (
    BENEFIT_CATEGORY_META[category as BenefitCategory] ??
    BENEFIT_CATEGORY_META.other
  );
}

/** First sentence / clause of a description as a teaser line. */
export function teaserLine(description: string, max = 68): string {
  const clean = description.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Tap to see details';
  const firstSentence = clean.split(/(?<=[.!])\s/)[0];
  const base = firstSentence.length <= max ? firstSentence : clean;
  return base.length <= max ? base : `${base.slice(0, max - 1).trimEnd()}…`;
}
