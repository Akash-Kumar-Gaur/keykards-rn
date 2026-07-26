/**
 * Vault list density tiers — the layout scales with how many cards a user owns.
 *
 * Tier is driven by the TOTAL card count, not the filtered count, so applying a
 * filter never reshuffles the layout mid-interaction. "Adds their 4th card"
 * changes density; "filters to Visa" does not.
 */

export type VaultDensity = 'spotlight' | 'compact' | 'dense';

/** Inclusive upper bounds for each tier; 8+ falls through to dense. */
export const VAULT_TIER_THRESHOLDS = {
  spotlightMax: 3,
  compactMax: 7,
} as const;

export function vaultDensityForCount(count: number): VaultDensity {
  if (count <= VAULT_TIER_THRESHOLDS.spotlightMax) return 'spotlight';
  if (count <= VAULT_TIER_THRESHOLDS.compactMax) return 'compact';
  return 'dense';
}

/**
 * Card geometry per tier for a given available width.
 * Spotlight keeps the real 1.586 card ratio; compact is ~57% of that height so
 * it reads as a distinct row rather than a shrunken card.
 */
export const SPOTLIGHT_ASPECT = 1.586;
export const COMPACT_HEIGHT_FACTOR = 0.57;
export const DENSE_ROW_HEIGHT = 64;

export function vaultCardHeight(density: VaultDensity, width: number): number {
  const spotlight = width / SPOTLIGHT_ASPECT;
  if (density === 'spotlight') return Math.round(spotlight);
  if (density === 'compact') return Math.round(spotlight * COMPACT_HEIGHT_FACTOR);
  return DENSE_ROW_HEIGHT;
}

/** Vertical gap between items — tighter as density rises, never zero. */
export function vaultItemGap(density: VaultDensity): number {
  if (density === 'spotlight') return 24;
  if (density === 'compact') return 12;
  return 8;
}

/** Entrance stagger per item; capped so a long dense list doesn't crawl in. */
export function vaultStagger(density: VaultDensity, index: number): number {
  const step = density === 'spotlight' ? 90 : density === 'compact' ? 55 : 28;
  return Math.min(index, 8) * step;
}

/** Tier 1 only — the one-shot gloss sweep fires after the entrance settles. */
export function shouldShineSweep(density: VaultDensity): boolean {
  return density === 'spotlight';
}
