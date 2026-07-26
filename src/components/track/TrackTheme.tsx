/**
 * TrackTheme — animates page accent between default indigo and a card theme
 * via Reanimated interpolateColor. Only accent/highlight layer; layout unchanged.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  TRACK_DEFAULT_ACCENT,
  TRACK_DEFAULT_ACCENT_DEEP,
  hexToSoft,
  type TrackAccentPair,
} from '@/lib/trackAccent';
import { motion } from '@/theme';

const DURATION = 480;

type TrackThemeContextValue = {
  /** Target accent (updates immediately when scope changes). */
  accent: string;
  accentDeep: string;
  accentSoft: string;
  progress: SharedValue<number>;
  fromAccent: SharedValue<string>;
  toAccent: SharedValue<string>;
  fromDeep: SharedValue<string>;
  toDeep: SharedValue<string>;
};

const TrackThemeContext = createContext<TrackThemeContextValue | null>(null);

export function TrackThemeProvider({
  pair,
  children,
}: {
  pair: TrackAccentPair;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  const fromAccent = useSharedValue(pair.accent);
  const toAccent = useSharedValue(pair.accent);
  const fromDeep = useSharedValue(pair.accentDeep);
  const toDeep = useSharedValue(pair.accentDeep);

  useEffect(() => {
    fromAccent.value = toAccent.value;
    toAccent.value = pair.accent;
    fromDeep.value = toDeep.value;
    toDeep.value = pair.accentDeep;
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.accent, pair.accentDeep, reduced]);

  const value = useMemo(
    () => ({
      accent: pair.accent,
      accentDeep: pair.accentDeep,
      accentSoft: pair.accentSoft,
      progress,
      fromAccent,
      toAccent,
      fromDeep,
      toDeep,
    }),
    [pair.accent, pair.accentDeep, pair.accentSoft, progress, fromAccent, toAccent, fromDeep, toDeep],
  );

  return (
    <TrackThemeContext.Provider value={value}>{children}</TrackThemeContext.Provider>
  );
}

export function useTrackTheme(): TrackThemeContextValue {
  const ctx = useContext(TrackThemeContext);
  if (!ctx) {
    // Safe fallback outside provider (tests / stray mounts).
    return {
      accent: TRACK_DEFAULT_ACCENT,
      accentDeep: TRACK_DEFAULT_ACCENT_DEEP,
      accentSoft: hexToSoft(TRACK_DEFAULT_ACCENT),
      progress: { value: 1 } as SharedValue<number>,
      fromAccent: { value: TRACK_DEFAULT_ACCENT } as SharedValue<string>,
      toAccent: { value: TRACK_DEFAULT_ACCENT } as SharedValue<string>,
      fromDeep: { value: TRACK_DEFAULT_ACCENT_DEEP } as SharedValue<string>,
      toDeep: { value: TRACK_DEFAULT_ACCENT_DEEP } as SharedValue<string>,
    };
  }
  return ctx;
}

/** Animated backgroundColor / borderColor / color for accent chrome. */
export function useTrackAccentBgStyle() {
  const { progress, fromAccent, toAccent } = useTrackTheme();
  return useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [fromAccent.value, toAccent.value],
    ),
  }));
}

export function useTrackAccentColorStyle() {
  const { progress, fromAccent, toAccent } = useTrackTheme();
  return useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [fromAccent.value, toAccent.value],
    ),
  }));
}

export function useTrackAccentBorderStyle() {
  const { progress, fromAccent, toAccent } = useTrackTheme();
  return useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [fromAccent.value, toAccent.value],
    ),
  }));
}

/** Soft badge background that tracks the accent. */
export function useTrackAccentSoftBgStyle() {
  const { progress, fromAccent, toAccent } = useTrackTheme();
  return useAnimatedStyle(() => {
    const c = interpolateColor(
      progress.value,
      [0, 1],
      [fromAccent.value, toAccent.value],
    );
    // Soften via opacity on the view; solid soft rgba can't interpolate from hex easily mid-flight.
    return { backgroundColor: c, opacity: 0.22 };
  });
}

export const TRACK_THEME_DURATION = DURATION;
export { motion };
