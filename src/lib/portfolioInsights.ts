/**
 * Portfolio insights — qualitative cross-card facts from listed benefits.
 * Never sums value_estimate into a “portfolio value” figure for display.
 */

import {
  benefitOverlapKey,
  type BenefitLike,
} from '@/lib/catalogBenefitParse';
import { formatInr } from '@/lib/cardUtils';

export type PortfolioCardInput = {
  id: string;
  nickname: string;
  annualFee: number | null;
  benefits: BenefitLike[];
};

export type LoungePortfolioSummary = {
  /** @deprecated Kept for tests; UI no longer shows summed visit counts. */
  totalVisitsPerYear: number;
  cardsWithLounge: number;
  lines: Array<{ cardNickname: string; visits: number; title: string }>;
};

export type BenefitOverlap = {
  category: string;
  label: string;
  cardNicknames: string[];
  hint: string;
};

export type PortfolioFeeValue = {
  totalFees: number;
  totalBenefitValue: number;
  feeLabel: string;
  valueLabel: string;
  netLabel: string;
  cardsCounted: number;
};

export type PortfolioInsights = {
  lounge: LoungePortfolioSummary | null;
  overlaps: BenefitOverlap[];
  /** Always null in product UI — fee vs value_estimate sums are not shown. */
  feeValue: PortfolioFeeValue | null;
};

export function computeLoungeSummary(
  cards: PortfolioCardInput[],
): LoungePortfolioSummary | null {
  const lines: LoungePortfolioSummary['lines'] = [];
  const cardsWith = new Set<string>();

  for (const card of cards) {
    for (const b of card.benefits) {
      if (String(b.category).toLowerCase() !== 'lounge') continue;
      lines.push({
        cardNickname: card.nickname,
        visits: 0,
        title: b.title.trim() || 'Lounge access',
      });
      cardsWith.add(card.id);
    }
  }

  if (lines.length === 0) return null;
  return {
    totalVisitsPerYear: 0,
    cardsWithLounge: cardsWith.size,
    lines,
  };
}

export function detectBenefitOverlaps(
  cards: PortfolioCardInput[],
): BenefitOverlap[] {
  if (cards.length < 2) return [];

  type Acc = { category: string; title: string; nicknames: Set<string> };
  const byKey = new Map<string, Acc>();

  for (const card of cards) {
    for (const b of card.benefits) {
      const key = benefitOverlapKey(b);
      const existing = byKey.get(key);
      if (existing) {
        existing.nicknames.add(card.nickname);
      } else {
        byKey.set(key, {
          category: String(b.category),
          title: b.title,
          nicknames: new Set([card.nickname]),
        });
      }
    }
  }

  const overlaps: BenefitOverlap[] = [];
  for (const acc of byKey.values()) {
    if (acc.nicknames.size < 2) continue;
    const names = [...acc.nicknames];
    overlaps.push({
      category: acc.category,
      label: acc.title,
      cardNicknames: names,
      hint: `You may not need both of these for ${acc.category}`,
    });
  }

  return overlaps.sort((a, b) => b.cardNicknames.length - a.cardNicknames.length);
}

/** @deprecated Not used in product UI — kept for unit tests / tooling. */
export function computePortfolioFeeValue(
  cards: PortfolioCardInput[],
): PortfolioFeeValue | null {
  if (cards.length === 0) return null;

  let totalFees = 0;
  let cardsCounted = 0;

  for (const card of cards) {
    const fee = card.annualFee ?? 0;
    if (fee <= 0) continue;
    cardsCounted += 1;
    totalFees += fee;
  }

  if (cardsCounted === 0) return null;

  return {
    totalFees,
    totalBenefitValue: 0,
    feeLabel: formatInr(totalFees),
    valueLabel: formatInr(0),
    netLabel: formatInr(-totalFees),
    cardsCounted,
  };
}

export function computePortfolioInsights(
  cards: PortfolioCardInput[],
): PortfolioInsights {
  return {
    lounge: computeLoungeSummary(cards),
    overlaps: detectBenefitOverlaps(cards).slice(0, 4),
    feeValue: null,
  };
}
