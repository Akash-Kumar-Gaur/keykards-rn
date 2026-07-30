/**
 * Vault list geometry — one consistent compact row height for every card count.
 * Scrolling scales capacity; we no longer switch Spotlight/Compact/Dense tiers.
 */

/** Fixed row height used by every vault card (matches reference density). */
export const VAULT_ROW_HEIGHT = 96;

/** Vertical gap between rows. */
export const VAULT_ROW_GAP = 12;

/** Entrance stagger per row (ms), capped so long lists still land quickly. */
export function vaultRowStagger(index: number): number {
  const step = 70;
  return Math.min(index, 12) * step;
}
