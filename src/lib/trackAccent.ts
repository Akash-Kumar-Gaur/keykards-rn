/**
 * Track accent helpers — resolve card theme → accent pair for page tinting.
 */

import { getCardTheme } from '@/lib/cardThemes';
import { darkPalette, type AppPalette } from '@/theme/colors';
import type { CardColorTheme } from '@/types/card';
import type { TrackSnapshot } from '@/types/track';

/** Dark-indigo fallbacks (tests / module scope). Prefer `defaultTrackAccent(usePalette())`. */
export const TRACK_DEFAULT_ACCENT = darkPalette.indigo;
export const TRACK_DEFAULT_ACCENT_DEEP = darkPalette.indigoDeep;

export type TrackAccentPair = {
  accent: string;
  accentDeep: string;
  accentSoft: string;
};

/** Soft fill from a solid hex (#RRGGBB) at given alpha. */
export function hexToSoft(hex: string, alpha = 0.16): string {
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 6) return darkPalette.indigoSoft;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return darkPalette.indigoSoft;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function accentPairFromThemeId(
  themeId: CardColorTheme | string | null | undefined,
  chrome: AppPalette = darkPalette,
): TrackAccentPair {
  if (!themeId) return defaultTrackAccent(chrome);
  const theme = getCardTheme(themeId);
  const accent = theme.colors[0];
  const accentDeep = theme.colors[1];
  return {
    accent,
    accentDeep,
    accentSoft: hexToSoft(accent),
  };
}

export function defaultTrackAccent(chrome: AppPalette = darkPalette): TrackAccentPair {
  return {
    accent: chrome.indigo,
    accentDeep: chrome.indigoDeep,
    accentSoft: chrome.indigoSoft,
  };
}

/** Filter portfolio snapshot to one card (or pass through for All). */
export function filterTrackSnapshot(
  snapshot: TrackSnapshot,
  cardId: string | null,
): TrackSnapshot {
  if (!cardId) return snapshot;
  return {
    ...snapshot,
    milestones: snapshot.milestones.filter((m) => m.cardId === cardId),
    feePayback: snapshot.feePayback.filter((f) => f.cardId === cardId),
    pointsExpiring: snapshot.pointsExpiring.filter((p) => p.cardId === cardId),
    renewals: snapshot.renewals.filter((r) => r.cardId === cardId),
  };
}
