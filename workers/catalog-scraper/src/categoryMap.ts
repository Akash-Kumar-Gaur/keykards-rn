/**
 * Map LLM benefit categories → InWallet card_benefits / catalog categories.
 */

import type { CatalogBenefitCategory, LlmBenefitCategory } from './types.js';

const MAP: Record<LlmBenefitCategory, CatalogBenefitCategory> = {
  lounge: 'lounge',
  dining: 'dining',
  travel: 'travel',
  shopping: 'shopping',
  fuel: 'fuel',
  entertainment: 'entertainment',
  milestone: 'shopping',
  other: 'other',
};

export function mapBenefitCategory(
  raw: string | undefined,
): CatalogBenefitCategory {
  if (!raw) return 'other';
  const key = raw.toLowerCase() as LlmBenefitCategory;
  return MAP[key] ?? 'other';
}

export function mapNetwork(raw: string | undefined, fallback: string): string {
  if (!raw) return normalizeNetwork(fallback);
  return normalizeNetwork(raw);
}

function normalizeNetwork(n: string): string {
  const t = n.trim();
  if (/rupay/i.test(t)) return 'RuPay';
  if (/master/i.test(t)) return 'Mastercard';
  if (/amex|american\s*express/i.test(t)) return 'Amex';
  if (/diner/i.test(t)) return 'Diners';
  if (/visa/i.test(t)) return 'Visa';
  return 'Visa';
}

/** Bank → deep/metallic theme keys (aligned with app cardThemes + BANK_THEME_HINTS). */
const THEME_BY_BANK: Record<string, string> = {
  'HDFC Bank': 'hdfc-maroon',
  'SBI Card': 'sbi-indigo',
  SBI: 'sbi-indigo',
  'Axis Bank': 'axis-burgundy',
  'ICICI Bank': 'icici-amber',
  'Kotak Bank': 'kotak-crimson',
  'Kotak Mahindra Bank': 'kotak-crimson',
  'IDFC FIRST Bank': 'idfc-copper',
  'Yes Bank': 'generic-slate',
  'IndusInd Bank': 'axis-burgundy',
  'RBL Bank': 'generic-emerald',
  'Standard Chartered': 'generic-slate',
  'American Express': 'amex-gunmetal',
};

const THEME_HINTS: Array<{ match: string; theme: string }> = [
  { match: 'hdfc', theme: 'hdfc-maroon' },
  { match: 'sbi card', theme: 'sbi-indigo' },
  { match: 'state bank', theme: 'sbi-indigo' },
  { match: 'sbi', theme: 'sbi-indigo' },
  { match: 'axis', theme: 'axis-burgundy' },
  { match: 'icici', theme: 'icici-amber' },
  { match: 'kotak', theme: 'kotak-crimson' },
  { match: 'idfc', theme: 'idfc-copper' },
  { match: 'american express', theme: 'amex-gunmetal' },
  { match: 'amex', theme: 'amex-gunmetal' },
  { match: 'diner', theme: 'diners-navy' },
  { match: 'yes bank', theme: 'generic-slate' },
  { match: 'indusind', theme: 'axis-burgundy' },
  { match: 'rbl', theme: 'generic-emerald' },
  { match: 'standard chartered', theme: 'generic-slate' },
];

export function themeForBank(bank: string): string {
  if (THEME_BY_BANK[bank]) return THEME_BY_BANK[bank];
  const raw = bank.trim().toLowerCase();
  const sorted = [...THEME_HINTS].sort((a, b) => b.match.length - a.match.length);
  for (const hint of sorted) {
    if (raw.includes(hint.match)) return hint.theme;
  }
  return 'generic-violet';
}

/** Themes allowed by card_catalog_theme_check / cards_color_theme_check. */
const ALLOWED_THEMES = new Set([
  'generic-violet',
  'generic-slate',
  'generic-emerald',
  'indigo',
  'midnight',
  'obsidian',
  'slate',
  'emerald',
  'amber',
  'hdfc-maroon',
  'sbi-indigo',
  'axis-burgundy',
  'icici-amber',
  'kotak-crimson',
  'idfc-copper',
  'amex-gunmetal',
  'diners-navy',
]);

export function coerceCatalogTheme(
  candidate: string | null | undefined,
  bank: string,
): string {
  const fromBank = themeForBank(bank);
  if (
    candidate &&
    ALLOWED_THEMES.has(candidate) &&
    /^[a-z0-9-]+$/.test(candidate)
  ) {
    return candidate;
  }
  return ALLOWED_THEMES.has(fromBank) ? fromBank : 'generic-violet';
}
