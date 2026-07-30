/**
 * Catalog-powered Smart Swipe — pick the best vault card for a spend category
 * using card_benefits. Ranking may use rates; UI shows stated facts only.
 */

import {
  scoreBenefitRewardRate,
  type BenefitLike,
} from '@/lib/catalogBenefitParse';
import type { BenefitCategory } from '@/types/card';
import type { SmartSwipeRecommendation } from '@/types/dashboard';

const CATEGORY_LABELS: Record<BenefitCategory, string> = {
  lounge: 'Lounge',
  dining: 'Dining',
  travel: 'Travel',
  shopping: 'Shopping',
  fuel: 'Fuel',
  entertainment: 'Entertainment',
  other: 'Other',
};

export const SMART_SWIPE_CATEGORIES: BenefitCategory[] = [
  'dining',
  'shopping',
  'fuel',
  'travel',
  'entertainment',
  'lounge',
];

export type CatalogSmartSwipeCard = {
  id: string;
  nickname: string;
  benefits: BenefitLike[];
};

export type CatalogSmartSwipeResult = SmartSwipeRecommendation & {
  cardId: string;
  categoryKey: BenefitCategory;
};

/**
 * Recommend the vault card whose benefits score highest for `category`.
 * Returns null when fewer than 2 cards or no card has a usable signal.
 */
export function recommendCatalogSmartSwipe(args: {
  cards: CatalogSmartSwipeCard[];
  category: BenefitCategory;
}): CatalogSmartSwipeResult | null {
  const { cards, category } = args;
  if (cards.length < 2) return null;

  let best: {
    card: CatalogSmartSwipeCard;
    score: number;
    benefitFact: string;
  } | null = null;

  for (const card of cards) {
    const matching = card.benefits.filter((b) => b.category === category);
    const pool =
      matching.length > 0
        ? matching
        : category === 'shopping'
          ? card.benefits.filter((b) =>
              /reward|cashback|points/i.test(`${b.title} ${b.description ?? ''}`),
            )
          : [];

    if (pool.length === 0) continue;

    let cardBest: ReturnType<typeof scoreBenefitRewardRate> = null;
    for (const b of pool) {
      const scored = scoreBenefitRewardRate(b);
      if (!scored) continue;
      if (!cardBest || scored.score > cardBest.score) cardBest = scored;
    }
    if (!cardBest) continue;

    if (!best || cardBest.score > best.score) {
      best = {
        card,
        score: cardBest.score,
        benefitFact: cardBest.benefitFact,
      };
    }
  }

  if (!best) return null;

  const meta = CATEGORY_LABELS[category];
  return {
    cardId: best.card.id,
    cardName: best.card.nickname,
    category: meta,
    categoryKey: category,
    // rewardValue = stated benefit fact (not a ₹ earn estimate)
    rewardValue: best.benefitFact,
    rewardLabel: 'Listed benefit',
  };
}

/** Pick a default category: rotate by day-of-year among those with ≥1 matching benefit. */
export function pickDefaultSmartSwipeCategory(
  cards: CatalogSmartSwipeCard[],
  now = new Date(),
): BenefitCategory {
  const day = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      86_400_000,
  );
  const available = SMART_SWIPE_CATEGORIES.filter((cat) =>
    cards.some((c) => c.benefits.some((b) => b.category === cat)),
  );
  const pool = available.length > 0 ? available : SMART_SWIPE_CATEGORIES;
  return pool[day % pool.length]!;
}
