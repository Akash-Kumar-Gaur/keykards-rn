/**
 * On-brand card face gradient presets — not a free color picker.
 * Includes bank-inspired metallic/deep tones + neutral generics.
 */

import { palette } from '@/theme';
import type { CardColorTheme } from '@/types/card';

export interface CardThemePreset {
  id: CardColorTheme;
  label: string;
  colors: readonly [string, string];
  /** Bank-inspired presets shown with a suggestion chip when matched. */
  bankInspired?: boolean;
}

/**
 * Deep / metallic gradients only — no flat brights.
 * Stops are dark enough that chip + embossed text stay readable.
 */
export const CARD_THEME_PRESETS: readonly CardThemePreset[] = [
  // Neutrals / generics (default picker row)
  {
    id: 'generic-violet',
    label: 'Violet',
    colors: ['#4C3A7A', '#1A1228'],
  },
  {
    id: 'generic-slate',
    label: 'Slate',
    colors: ['#3F4A5A', '#141820'],
  },
  {
    id: 'generic-emerald',
    label: 'Emerald',
    colors: ['#0F5C52', '#0A201C'],
  },
  // Legacy keys kept so existing user cards still render
  { id: 'indigo', label: 'Indigo', colors: [palette.indigo, palette.indigoDeep] },
  { id: 'midnight', label: 'Midnight', colors: ['#3D348B', '#1A1638'] },
  { id: 'obsidian', label: 'Obsidian', colors: ['#2A2A3C', '#12121F'] },
  { id: 'slate', label: 'Slate (classic)', colors: ['#4A5568', '#1A202C'] },
  { id: 'emerald', label: 'Emerald (classic)', colors: ['#0F766E', '#134E4A'] },
  { id: 'amber', label: 'Amber (classic)', colors: ['#B45309', '#78350F'] },
  // Bank-inspired
  {
    id: 'hdfc-maroon',
    label: 'HDFC Maroon',
    colors: ['#6B1E2A', '#2A0A12'],
    bankInspired: true,
  },
  {
    id: 'sbi-indigo',
    label: 'SBI Indigo',
    colors: ['#1E3A8A', '#0B1530'],
    bankInspired: true,
  },
  {
    id: 'axis-burgundy',
    label: 'Axis Burgundy',
    colors: ['#5C1A2E', '#1F0A14'],
    bankInspired: true,
  },
  {
    id: 'icici-amber',
    label: 'ICICI Amber',
    colors: ['#9A4A12', '#3D1C08'],
    bankInspired: true,
  },
  {
    id: 'kotak-crimson',
    label: 'Kotak Crimson',
    colors: ['#7F1D1D', '#2A0A0A'],
    bankInspired: true,
  },
  {
    id: 'idfc-copper',
    label: 'IDFC Copper',
    colors: ['#8B3A18', '#2E1408'],
    bankInspired: true,
  },
  {
    id: 'amex-gunmetal',
    label: 'Amex Gunmetal',
    colors: ['#3F3A32', '#141210'],
    bankInspired: true,
  },
  {
    id: 'diners-navy',
    label: 'Diners Navy',
    colors: ['#1E3A5F', '#0A1220'],
    bankInspired: true,
  },
] as const;

/** Default when nothing matches. */
export const DEFAULT_CARD_THEME: CardColorTheme = 'generic-violet';

/**
 * Case-insensitive bank-name → theme. Longer / more specific keys first
 * when matching via substring (see suggestThemeForBank).
 */
export const BANK_THEME_HINTS: ReadonlyArray<{ match: string; theme: CardColorTheme }> = [
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
  { match: 'diners', theme: 'diners-navy' },
  { match: 'yes bank', theme: 'generic-slate' },
  { match: 'indusind', theme: 'axis-burgundy' },
  { match: 'rbl', theme: 'generic-emerald' },
  { match: 'standard chartered', theme: 'generic-slate' },
];

export function getCardTheme(id: CardColorTheme | string | null | undefined): CardThemePreset {
  const found = CARD_THEME_PRESETS.find((p) => p.id === id);
  return found ?? CARD_THEME_PRESETS.find((p) => p.id === DEFAULT_CARD_THEME)!;
}

/**
 * Suggest a theme from a free-text bank name (manual entry or catalog bank).
 */
export function suggestThemeForBank(bankName: string | null | undefined): CardColorTheme | null {
  const raw = (bankName ?? '').trim().toLowerCase();
  if (!raw) return null;
  // Prefer longer match strings (e.g. "sbi card" before "sbi")
  const sorted = [...BANK_THEME_HINTS].sort((a, b) => b.match.length - a.match.length);
  for (const hint of sorted) {
    if (raw.includes(hint.match)) return hint.theme;
  }
  return null;
}

export function isValidCardTheme(id: string): id is CardColorTheme {
  return CARD_THEME_PRESETS.some((p) => p.id === id);
}
