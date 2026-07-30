/**
 * Parse structured signals from catalog / vault benefit text.
 * Lounge visits, reward rates, and purchase-protection wording live in free
 * text today — these helpers are the catalog-first product surface.
 *
 * Display rule: UI may show stated bank facts (e.g. benefit title, “5% cashback”
 * as written). Never surface LLM/inferred ₹ value_estimate as a number.
 */

import type { BenefitCategory } from '@/types/card';

export type BenefitLike = {
  title: string;
  category: BenefitCategory | string;
  description?: string | null;
  valueEstimate?: number | null;
};

/**
 * Extract annual lounge visit count only when the text states an annual figure
 * explicitly (or “N/year”). Quarterly phrasing alone is not annualized for
 * display — that would invent a number.
 */
export function parseLoungeVisitsPerYear(benefit: BenefitLike): number | null {
  if (benefit.category !== 'lounge') return null;
  const text = `${benefit.title} ${benefit.description ?? ''}`;

  const perYear = text.match(
    /(\d+)\s*(?:complimentary\s+)?(?:visits?|entries?)\s*(?:per\s*year|\/\s*year|a\s*year)/i,
  );
  if (perYear) return Number(perYear[1]);

  const parenYear = text.match(/\((\d+)\s*(?:visits?\s*)?\/\s*year\)/i);
  if (parenYear) return Number(parenYear[1]);

  // Explicit “(8/year)” style after a quarterly clause — take the stated annual
  const statedAnnual = text.match(/\((\d+)\s*\/\s*year\)/i);
  if (statedAnnual) return Number(statedAnnual[1]);

  if (/per\s*year|\/\s*year|annual/i.test(text)) {
    const n = text.match(
      /(\d+)\s*(?:complimentary\s+)?(?:domestic\s+|international\s+)?(?:airport\s+)?lounge/i,
    );
    if (n) return Number(n[1]);
  }

  return null;
}

/** Short stated fact for UI — never a computed ₹ estimate. */
export function benefitDisplayFact(benefit: BenefitLike): string {
  const title = benefit.title.trim();
  const desc = (benefit.description ?? '').trim();
  if (title && desc) {
    // Prefer title; append a short clause from description if title is generic
    if (title.length < 20 && desc.length > 0) {
      const clause = desc.split(/[.;]/)[0]?.trim() ?? desc;
      const combined = `${title} — ${clause}`;
      return combined.length > 90 ? `${combined.slice(0, 87)}…` : combined;
    }
    return title.length > 80 ? `${title.slice(0, 77)}…` : title;
  }
  return title || desc.slice(0, 80) || 'Listed benefit';
}

export type RewardRateScore = {
  /** Internal ranking only — never shown as a user-facing “earn” figure. */
  score: number;
  /** Stated benefit fact for UI (title / description), not a ₹ projection. */
  benefitFact: string;
};

/**
 * Score a benefit for spend-category Smart Swipe ranking.
 * Display uses benefitFact; value_estimate never becomes a shown rupee amount.
 */
export function scoreBenefitRewardRate(benefit: BenefitLike): RewardRateScore | null {
  const text = `${benefit.title} ${benefit.description ?? ''}`;
  const fact = benefitDisplayFact(benefit);

  // "4 Reward Points per ₹150" / "4 pts/₹150" — stated rate (ranking signal)
  const ptsPer = text.match(
    /(\d+(?:\.\d+)?)\s*(?:reward\s*)?points?\s*(?:per|\/|on every)\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i,
  );
  if (ptsPer) {
    const pts = Number(ptsPer[1]);
    const rupees = Number(ptsPer[2].replace(/,/g, ''));
    if (pts > 0 && rupees > 0) {
      return {
        score: (pts / rupees) * 100,
        benefitFact: fact,
      };
    }
  }

  const cashback = text.match(/(\d+(?:\.\d+)?)\s*%\s*cash\s*-?back/i);
  if (cashback) {
    const pct = Number(cashback[1]);
    return {
      score: pct * 10,
      benefitFact: fact,
    };
  }

  const multiplier = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(?:points?|rewards?)?/i);
  if (multiplier) {
    const x = Number(multiplier[1]);
    return {
      score: x * 8,
      benefitFact: fact,
    };
  }

  // value_estimate may influence weak ranking but is never returned for display
  if (benefit.valueEstimate != null && benefit.valueEstimate > 0) {
    return {
      score: Math.min(benefit.valueEstimate / 500, 40),
      benefitFact: fact,
    };
  }

  if (!fact) return null;
  return {
    score: 1,
    benefitFact: fact,
  };
}

const PROTECTION_RE =
  /purchase\s+protection|extended\s+warranty|warranty\s+protection|buyers?\s+protection|damage\s+protection|theft\s+protection/i;

export function isPurchaseProtectionBenefit(benefit: BenefitLike): boolean {
  const text = `${benefit.title} ${benefit.description ?? ''}`;
  return PROTECTION_RE.test(text);
}

/** Normalize benefit titles for overlap detection. */
export function benefitOverlapKey(benefit: BenefitLike): string {
  const cat = String(benefit.category).toLowerCase();
  const title = benefit.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const core = title
    .replace(/\b(complimentary|domestic|international|airport)\b/g, '')
    .replace(/\b(visits?|access|membership|cover|protection)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${cat}::${core.slice(0, 40)}`;
}
