/**
 * Card-preview badge zone geometry — source of truth for indicator slots.
 *
 * Layouts:
 *  - `spotlight` — full CardFace (detail / flip / forms)
 *  - `list` — VaultListCard full-width compact row
 *
 * Sync/status never shares a corner with the network mark. On Vault list rows,
 * STATUS sits under the nickname (left column); last-four + network live in the
 * trailing column. Vault browsing still does not render sync UI (see
 * cardBadgeZones.tsx) — the zone is reserved so a future indicator can’t collide.
 */

import { spacing } from '@/theme';
import { VAULT_ROW_HEIGHT } from '@/lib/vaultDensity';

/** Fixed outer box of the network mark, by size. Mirrors NetworkBadge. */
export const NETWORK_BADGE_SIZE = {
  sm: { w: 40, h: 26, font: 10, radius: 6 },
  md: { w: 56, h: 36, font: 12, radius: 8 },
} as const;

/** Full CardFace geometry. */
export const SPOTLIGHT_PADDING = spacing.xl;
export const SPOTLIGHT_TITLE_H = 42;
export const STATUS_ROW_GAP = spacing.xs;
export const STATUS_ROW_H = 20;
export const BOTTOM_ROW_H = 36;

/** Vault list row geometry. */
export const LIST_PADDING_H = spacing.lg;
export const LIST_GAP = spacing.md;
export const LIST_TRAILING_W = 88;
export const SYNC_DOT_SIZE = 10;

/** Card-detail hero only: gutters reserved either side of BOTTOM_CENTER. */
export const REVEAL_AFFORDANCE_GUTTER = 88;
export const REVEAL_AFFORDANCE_H = 26;

export type Rect = { x: number; y: number; w: number; h: number };

export type CardPreviewLayout = 'spotlight' | 'list';

export type ZoneName =
  | 'TOP_LEFT'
  | 'STATUS'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'BOTTOM_RIGHT'
  | 'NETWORK'
  | 'TRAILING_VALUE';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/**
 * Occupied zones for one card preview of the given box.
 * `withRevealAffordance` adds the card-detail hero's BOTTOM_CENTER pill.
 */
export function cardPreviewZones(
  layout: CardPreviewLayout,
  width: number,
  height: number,
  withRevealAffordance = false,
): Partial<Record<ZoneName, Rect>> {
  if (layout === 'list') {
    const pad = LIST_PADDING_H;
    const trailingX = width - pad - LIST_TRAILING_W;
    const textW = trailingX - LIST_GAP - pad;
    const midY = height / 2;

    return {
      TOP_LEFT: { x: pad, y: midY - 22, w: textW, h: 28 },
      // Sync/status under nickname — never in the trailing network column.
      STATUS: {
        x: pad,
        y: midY + 10,
        w: Math.min(textW, 72),
        h: STATUS_ROW_H,
      },
      TRAILING_VALUE: {
        x: trailingX,
        y: midY - 16,
        w: LIST_TRAILING_W,
        h: 18,
      },
      NETWORK: {
        x: trailingX,
        y: midY + 4,
        w: LIST_TRAILING_W,
        h: 16,
      },
    };
  }

  const pad = SPOTLIGHT_PADDING;
  const net = NETWORK_BADGE_SIZE.md;
  const inner = width - pad * 2;
  const bottomY = height - pad - BOTTOM_ROW_H;

  const zones: Partial<Record<ZoneName, Rect>> = {
    TOP_LEFT: { x: pad, y: pad, w: inner, h: SPOTLIGHT_TITLE_H },
    STATUS: {
      x: pad,
      y: pad + SPOTLIGHT_TITLE_H + STATUS_ROW_GAP,
      w: inner,
      h: STATUS_ROW_H,
    },
    BOTTOM_LEFT: { x: pad, y: bottomY, w: 82, h: BOTTOM_ROW_H },
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

/** Every pair of occupied zones that intersect — empty means the layout is safe. */
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

/** Convenience for tests — vault list uses the fixed row height. */
export function vaultListPreviewHeight(): number {
  return VAULT_ROW_HEIGHT;
}
