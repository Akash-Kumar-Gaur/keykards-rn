/**
 * CardThemeGlow — per-card ambient glow tinted to the card's theme gradient.
 * Dark canvas only: on light backgrounds the same bleed/opacity reads as a
 * soft-edged halo / oversized padding around the card, so we omit it.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { getCardTheme } from '@/lib/cardThemes';
import { useAppTheme } from '@/providers/AppThemeProvider';
import type { CardColorTheme } from '@/types/card';

/** Glow spreads this much past the card on every side (dark mode). */
const BLEED = 28;

export function CardThemeGlow({
  themeId,
  width,
  height,
  intensity,
  baseOpacity = 0.5,
}: {
  themeId: CardColorTheme;
  width: number;
  height: number;
  /** 0..1 press value that brightens the glow; omit for a static glow. */
  intensity?: SharedValue<number>;
  baseOpacity?: number;
}) {
  const { isLight } = useAppTheme();
  const theme = getCardTheme(themeId);
  const gradId = `cardGlow_${themeId}`.replace(/[^a-zA-Z0-9_]/g, '');
  const w = width + BLEED * 2;
  const h = height + BLEED * 2;

  const style = useAnimatedStyle(() => {
    if (!intensity) return { opacity: baseOpacity };
    return { opacity: baseOpacity + intensity.value * 0.35 };
  });

  // Dark-mode ambiance — no good light-mode equivalent without a padded halo.
  if (isLight) return null;
  if (width <= 0 || height <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { width: w, height: h, top: -BLEED, left: -BLEED }, style]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor={theme.colors[0]} stopOpacity={0.85} />
            <Stop offset="55%" stopColor={theme.colors[0]} stopOpacity={0.28} />
            <Stop offset="100%" stopColor={theme.colors[1]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
}

/** Accent color used for Tier 2's restrained edge glow. */
export function cardGlowAccent(themeId: CardColorTheme): string {
  return getCardTheme(themeId).colors[0];
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
});

export { BLEED as CARD_GLOW_BLEED };
