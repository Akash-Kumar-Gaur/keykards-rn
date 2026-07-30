/**
 * Regression guard for sync-status / network-mark overlap.
 *
 * Original bug: both badges absolute-positioned top-right on a compact preview.
 * These tests assert zones stay disjoint for CardFace (spotlight) and the
 * Vault list row layout across realistic phone widths.
 */

import {
  cardPreviewZones,
  overlappingZonePairs,
  rectsOverlap,
  NETWORK_BADGE_SIZE,
  REVEAL_AFFORDANCE_GUTTER,
  vaultListPreviewHeight,
  type CardPreviewLayout,
} from './badgeZones';

const WIDTHS = [320, 360, 390, 414, 430].map((w) => w - 40);
const LAYOUTS: CardPreviewLayout[] = ['spotlight', 'list'];

function heightFor(layout: CardPreviewLayout, width: number): number {
  if (layout === 'list') return vaultListPreviewHeight();
  return Math.round(width / 1.586);
}

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
  LAYOUTS.forEach((layout) => {
    it(`keeps every zone disjoint in the ${layout} layout`, () => {
      WIDTHS.forEach((width) => {
        const clashes = overlappingZonePairs(
          cardPreviewZones(layout, width, heightFor(layout, width)),
        );
        expect(clashes).toEqual([]);
      });
    });

    it(`keeps sync status clear of the network mark in ${layout}`, () => {
      WIDTHS.forEach((width) => {
        const zones = cardPreviewZones(layout, width, heightFor(layout, width));
        const status = zones.STATUS;
        const network = zones.NETWORK ?? zones.BOTTOM_RIGHT;
        expect(status).toBeDefined();
        expect(network).toBeDefined();
        expect(rectsOverlap(status!, network!)).toBe(false);
      });
    });
  });

  it('keeps the card-detail reveal pill clear of both bottom corners', () => {
    WIDTHS.forEach((width) => {
      const height = heightFor('spotlight', width);
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

describe('list layout stays legible at the narrowest width', () => {
  const narrow = Math.min(...WIDTHS);

  it('leaves a positive-width text column', () => {
    const zones = cardPreviewZones('list', narrow, vaultListPreviewHeight());
    expect(zones.TOP_LEFT!.w).toBeGreaterThan(80);
  });
});
