/**
 * Regression guard for the sync-badge / network-mark overlap.
 *
 * The original bug: both were absolutely positioned top-right on the compact
 * card preview. These tests assert that every badge zone is disjoint in ALL
 * THREE density tiers (their layouts differ, so tier 1 passing proves nothing
 * about tiers 2 and 3) across the range of realistic phone widths.
 */

import {
  cardPreviewZones,
  overlappingZonePairs,
  rectsOverlap,
  NETWORK_BADGE_SIZE,
  REVEAL_AFFORDANCE_GUTTER,
} from './badgeZones';
import { vaultCardHeight, type VaultDensity } from './vaultDensity';

/** Narrow → large phones, minus the Vault list's horizontal padding. */
const WIDTHS = [320, 360, 390, 414, 430].map((w) => w - 40);
const TIERS: VaultDensity[] = ['spotlight', 'compact', 'dense'];

describe('rectsOverlap', () => {
  it('detects the original bug: two badges both pinned top-right', () => {
    const network = { x: 260, y: 8, w: 40, h: 26 };
    const oldSyncBadge = { x: 214, y: 8, w: 86, h: 20 };
    expect(rectsOverlap(network, oldSyncBadge)).toBe(true);
  });

  it('treats touching edges as non-overlapping', () => {
    expect(
      rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }),
    ).toBe(false);
  });
});

describe('badge zones never overlap', () => {
  TIERS.forEach((density) => {
    it(`keeps every zone disjoint in the ${density} tier`, () => {
      WIDTHS.forEach((width) => {
        const height = vaultCardHeight(density, width);
        const clashes = overlappingZonePairs(
          cardPreviewZones(density, width, height),
        );
        expect(clashes).toEqual([]);
      });
    });

    it(`keeps the sync status zone clear of the network mark in ${density}`, () => {
      WIDTHS.forEach((width) => {
        const height = vaultCardHeight(density, width);
        const zones = cardPreviewZones(density, width, height);
        // Spotlight puts the network mark in the bottom-right corner; the other
        // tiers expose it as NETWORK. Sync status is STATUS (card tiers) or the
        // trailing dot (dense rows).
        const status = zones.STATUS ?? zones.TRAILING_STATUS;
        const network = zones.NETWORK ?? zones.BOTTOM_RIGHT;
        expect(status).toBeDefined();
        expect(network).toBeDefined();
        expect(rectsOverlap(status!, network!)).toBe(false);
      });
    });
  });

  it('keeps the card-detail reveal pill clear of both bottom corners', () => {
    WIDTHS.forEach((width) => {
      const height = vaultCardHeight('spotlight', width);
      const zones = cardPreviewZones('spotlight', width, height, true);
      expect(zones.BOTTOM_CENTER).toBeDefined();
      expect(rectsOverlap(zones.BOTTOM_CENTER!, zones.BOTTOM_LEFT!)).toBe(false);
      expect(rectsOverlap(zones.BOTTOM_CENTER!, zones.BOTTOM_RIGHT!)).toBe(false);
    });
  });

  it('reserves a gutter wider than the flanking badges it protects', () => {
    expect(REVEAL_AFFORDANCE_GUTTER).toBeGreaterThan(NETWORK_BADGE_SIZE.md.w);
  });
});

describe('tier layouts stay legible at the narrowest width', () => {
  const narrow = Math.min(...WIDTHS);

  it('leaves a positive-width text column in compact and dense tiers', () => {
    (['compact', 'dense'] as VaultDensity[]).forEach((density) => {
      const zones = cardPreviewZones(
        density,
        narrow,
        vaultCardHeight(density, narrow),
      );
      const text = zones.TOP_LEFT ?? zones.TEXT;
      expect(text!.w).toBeGreaterThan(80);
    });
  });
});
