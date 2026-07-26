/**
 * Vault density tier selection + geometry.
 */

import {
  COMPACT_HEIGHT_FACTOR,
  DENSE_ROW_HEIGHT,
  shouldShineSweep,
  vaultCardHeight,
  vaultDensityForCount,
  vaultItemGap,
  vaultStagger,
  VAULT_TIER_THRESHOLDS,
} from './vaultDensity';

describe('vaultDensityForCount', () => {
  it('uses spotlight for 1-3 cards', () => {
    expect(vaultDensityForCount(1)).toBe('spotlight');
    expect(vaultDensityForCount(2)).toBe('spotlight');
    expect(vaultDensityForCount(3)).toBe('spotlight');
  });

  it('uses compact for 4-7 cards', () => {
    expect(vaultDensityForCount(4)).toBe('compact');
    expect(vaultDensityForCount(7)).toBe('compact');
  });

  it('uses dense for 8 or more cards', () => {
    expect(vaultDensityForCount(8)).toBe('dense');
    expect(vaultDensityForCount(25)).toBe('dense');
  });

  it('crosses tiers exactly at the documented thresholds', () => {
    const { spotlightMax, compactMax } = VAULT_TIER_THRESHOLDS;
    expect(vaultDensityForCount(spotlightMax)).toBe('spotlight');
    expect(vaultDensityForCount(spotlightMax + 1)).toBe('compact');
    expect(vaultDensityForCount(compactMax)).toBe('compact');
    expect(vaultDensityForCount(compactMax + 1)).toBe('dense');
  });

  it('treats an empty vault as spotlight (empty state renders instead)', () => {
    expect(vaultDensityForCount(0)).toBe('spotlight');
  });
});

describe('vaultCardHeight', () => {
  const width = 340;

  it('keeps the true card aspect ratio at spotlight', () => {
    expect(vaultCardHeight('spotlight', width)).toBe(Math.round(width / 1.586));
  });

  it('makes compact 55-60% of spotlight height', () => {
    const spotlight = vaultCardHeight('spotlight', width);
    const compact = vaultCardHeight('compact', width);
    const ratio = compact / spotlight;
    expect(ratio).toBeGreaterThanOrEqual(0.55);
    expect(ratio).toBeLessThanOrEqual(0.6);
    expect(compact).toBe(Math.round((width / 1.586) * COMPACT_HEIGHT_FACTOR));
  });

  it('uses a fixed row height for dense', () => {
    expect(vaultCardHeight('dense', width)).toBe(DENSE_ROW_HEIGHT);
    expect(vaultCardHeight('dense', 1000)).toBe(DENSE_ROW_HEIGHT);
  });
});

describe('spacing + motion per tier', () => {
  it('tightens gaps as density rises but never touches', () => {
    expect(vaultItemGap('spotlight')).toBeGreaterThan(vaultItemGap('compact'));
    expect(vaultItemGap('compact')).toBeGreaterThan(vaultItemGap('dense'));
    expect(vaultItemGap('dense')).toBeGreaterThan(0);
  });

  it('caps entrance stagger so long lists still land quickly', () => {
    expect(vaultStagger('dense', 3)).toBeLessThan(vaultStagger('spotlight', 3));
    expect(vaultStagger('dense', 40)).toBe(vaultStagger('dense', 8));
  });

  it('only runs the gloss sweep in tier 1', () => {
    expect(shouldShineSweep('spotlight')).toBe(true);
    expect(shouldShineSweep('compact')).toBe(false);
    expect(shouldShineSweep('dense')).toBe(false);
  });
});
