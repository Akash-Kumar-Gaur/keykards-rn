/**
 * Card-preview badge zone geometry — the single source of truth for where
 * indicators may be drawn, shared by every density tier.
 *
 * The sync badge originally overlapped the network mark because each pass placed
 * its own badge with ad-hoc absolute coordinates. Every tier now derives its
 * badge slots from the constants here, and badgeZones.test.ts asserts that no
 * two zones intersect at any realistic screen width — so a future indicator
 * can't silently reintroduce the collision on a smaller variant.
 *
 * Zone names (see components/vault/cardBadgeZones.tsx for the visual map):
 *   TOP_LEFT | TOP_RIGHT | STATUS | BOTTOM_LEFT | BOTTOM_CENTER | BOTTOM_RIGHT
 * Row tiers use LEAD | TEXT | TRAILING_VALUE | TRAILING_STATUS.
 */

import { spacing } from '@/theme';
import type { VaultDensity } from '@/lib/vaultDensity';

/** Fixed outer box of the network mark, by size. Mirrors NetworkBadge. */
export const NETWORK_BADGE_SIZE = {
  sm: { w: 40, h: 26, font: 10, radius: 6 },
  md: { w: 56, h: 36, font: 12, radius: 8 },
} as const;

/** Tier 1 — CardFace `front` geometry. */
export const SPOTLIGHT_PADDING = spacing.xl;
export const SPOTLIGHT_TITLE_H = 42;
export const STATUS_ROW_GAP = spacing.xs;
export const STATUS_ROW_H = 20;
export const BOTTOM_ROW_H = 36;

/** Tier 2 — VaultCompactCard geometry. */
export const COMPACT_PADDING_H = spacing.lg;
export const COMPACT_GAP = spacing.md;
export const COMPACT_CHIP_W = 26;

/** Tier 3 — VaultDenseRow geometry. */
export const DENSE_ACCENT_W = 5;
export const DENSE_PADDING_H = spacing.md;
export const DENSE_GAP = spacing.md;
export const DENSE_LAST4_W = 62;
export const SYNC_DOT_SIZE = 10;

/** Card-detail hero only: gutters reserved either side of BOTTOM_CENTER. */
export const REVEAL_AFFORDANCE_GUTTER = 88;
export const REVEAL_AFFORDANCE_H = 26;

export type Rect = { x: number; y: number; w: number; h: number };

export type ZoneName =
  | 'TOP_LEFT'
  | 'STATUS'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'BOTTOM_RIGHT'
  /** Network mark on tiers where it is not a corner (compact trailing, dense lead). */
  | 'NETWORK'
  | 'LEAD'
  | 'TEXT'
  | 'TRAILING_VALUE'
  | 'TRAILING_STATUS';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/**
 * Occupied zones for one card preview of the given box.
 * `withRevealAffordance` adds the card-detail hero's BOTTOM_CENTER pill, which
 * is the only indicator permitted to overlay a card face.
 */
export function cardPreviewZones(
  density: VaultDensity,
  width: number,
  height: number,
  withRevealAffordance = false,
): Partial<Record<ZoneName, Rect>> {
  if (density === 'spotlight') {
    const pad = SPOTLIGHT_PADDING;
    const net = NETWORK_BADGE_SIZE.md;
    const inner = width - pad * 2;
    const bottomY = height - pad - BOTTOM_ROW_H;

    const zones: Partial<Record<ZoneName, Rect>> = {
      TOP_LEFT: { x: pad, y: pad, w: inner, h: SPOTLIGHT_TITLE_H },
      // Sync status lives BELOW the title block, never in a corner.
      STATUS: {
        x: pad,
        y: pad + SPOTLIGHT_TITLE_H + STATUS_ROW_GAP,
        w: inner,
        h: STATUS_ROW_H,
      },
      BOTTOM_LEFT: { x: pad, y: bottomY, w: 82, h: BOTTOM_ROW_H },
      // Network mark owns the bottom-right corner on full-size faces.
      BOTTOM_RIGHT: {
        x: width - pad - net.w,
        y: bottomY + (BOTTOM_ROW_H - net.h) / 2,
        w: net.w,
        h: net.h,
      },
    };

    if (withRevealAffordance) {
      const zoneX = pad + REVEAL_AFFORDANCE_GUTTER;
      zones.BOTTOM_CENTER = {
        x: zoneX,
        y: height - spacing.lg - REVEAL_AFFORDANCE_H,
        w: Math.max(0, width - zoneX * 2),
        h: REVEAL_AFFORDANCE_H,
      };
    }

    return zones;
  }

  if (density === 'compact') {
    const pad = COMPACT_PADDING_H;
    const net = NETWORK_BADGE_SIZE.sm;
    const chipX = pad;
    const textX = chipX + COMPACT_CHIP_W + COMPACT_GAP;
    const netX = width - pad - net.w;
    const textW = netX - COMPACT_GAP - textX;

    return {
      LEAD: { x: chipX, y: height / 2 - 10, w: COMPACT_CHIP_W, h: 19 },
      TOP_LEFT: { x: textX, y: height / 2 - 24, w: textW, h: 30 },
      // Status chip sits inside the text column, left of the network mark.
      STATUS: { x: textX, y: height / 2 + 8, w: textW, h: STATUS_ROW_H },
      NETWORK: {
        x: netX,
        y: height / 2 - net.h / 2,
        w: net.w,
        h: net.h,
      },
    };
  }

  // Dense rows have no contested corners: everything is a flow slot.
  const net = NETWORK_BADGE_SIZE.sm;
  const leadX = DENSE_ACCENT_W + DENSE_PADDING_H;
  const dotX = width - DENSE_PADDING_H - SYNC_DOT_SIZE;
  const last4X = dotX - DENSE_GAP - DENSE_LAST4_W;
  const textX = leadX + net.w + DENSE_GAP;

  return {
    NETWORK: { x: leadX, y: height / 2 - net.h / 2, w: net.w, h: net.h },
    TEXT: { x: textX, y: height / 2 - 16, w: last4X - DENSE_GAP - textX, h: 32 },
    TRAILING_VALUE: { x: last4X, y: height / 2 - 8, w: DENSE_LAST4_W, h: 16 },
    TRAILING_STATUS: {
      x: dotX,
      y: height / 2 - SYNC_DOT_SIZE / 2,
      w: SYNC_DOT_SIZE,
      h: SYNC_DOT_SIZE,
    },
  };
}

/** Every pair of occupied zones that intersect — empty means the tier is safe. */
export function overlappingZonePairs(
  zones: Partial<Record<ZoneName, Rect>>,
): [ZoneName, ZoneName][] {
  const entries = Object.entries(zones) as [ZoneName, Rect][];
  const clashes: [ZoneName, ZoneName][] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [nameA, a] = entries[i]!;
      const [nameB, b] = entries[j]!;
      if (rectsOverlap(a, b)) clashes.push([nameA, nameB]);
    }
  }
  return clashes;
}
