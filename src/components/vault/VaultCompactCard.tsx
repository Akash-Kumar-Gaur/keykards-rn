/**
 * TIER 2 — COMPACT (4-7 cards).
 * Reduced-height metallic face. Dark: restrained colored edge glow + themed
 * shadow. Light: tight table-top elevation only (no colored halo — reads as
 * padding on warm white).
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { NetworkBadge } from '@/components/vault/NetworkBadge';
import { CardMaterialOverlay } from '@/components/vault/CardMaterialOverlay';
import { cardGlowAccent } from '@/components/vault/CardThemeGlow';
import { getCardTheme } from '@/lib/cardThemes';
import {
  COMPACT_CHIP_W,
  COMPACT_GAP,
  COMPACT_PADDING_H,
} from '@/lib/badgeZones';
import { palette, radius, motion } from '@/theme';
import { useAppTheme } from '@/providers/AppThemeProvider';
import { useCardCanvasElevation } from '@/hooks/useCardCanvasElevation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VaultCard } from '@/types/card';

export function VaultCompactCard({
  card,
  height,
  onPress,
}: {
  card: VaultCard;
  height: number;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const { isLight } = useAppTheme();
  const canvasElevation = useCardCanvasElevation();
  const press = useSharedValue(0);
  const theme = getCardTheme(card.cardColorTheme);
  const accent = cardGlowAccent(card.cardColorTheme);

  const setPressed = (value: number) => {
    if (reduced) {
      press.value = value;
      return;
    }
    press.value = withSpring(value, motion.springConfig);
  };

  const animStyle = useAnimatedStyle(() => {
    const scale = 1 - press.value * 0.02;
    if (isLight) {
      return { transform: [{ scale }] };
    }
    return {
      transform: [{ scale }],
      shadowOpacity: 0.3 + press.value * 0.35,
      shadowRadius: 12 + press.value * 10,
    };
  });

  const edgeGlowStyle = useAnimatedStyle(() => ({
    opacity: isLight ? 0 : 0.45 + press.value * 0.45,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(1)}
      onPressOut={() => setPressed(0)}
      accessibilityRole="button"
      accessibilityLabel={`${card.nickname}, ${card.bankName}, ending ${card.lastFour}`}
    >
      <Animated.View
        style={[
          styles.shadowWrap,
          // Opaque fill required so Android elevation follows borderRadius
          // (transparent elevated wrappers cast a rectangular silhouette).
          { backgroundColor: theme.colors[0] },
          isLight
            ? canvasElevation
            : {
                shadowColor: accent,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              },
          animStyle,
        ]}
      >
        <LinearGradient
          colors={[...theme.colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { height }]}
        >
          <CardMaterialOverlay />
          {!isLight ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.edgeGlow, { borderColor: accent }, edgeGlowStyle]}
            />
          ) : null}

          <View style={styles.chip} />

          <View style={styles.textCol}>
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.7)"
              style={styles.bank}
              numberOfLines={1}
            >
              {card.bankName || 'Bank'}
            </AppText>
            <AppText variant="small" color={palette.white} numberOfLines={1}>
              {card.nickname}
            </AppText>
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.75)"
              style={styles.last4}
            >
              •••• {card.lastFour}
            </AppText>
          </View>

          <NetworkBadge network={card.network} size="sm" contrast="onDark" />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.lg,
    // Elevation/shadow come only from useCardCanvasElevation — do NOT stack
    // a second hardcoded elevation here (was elevation:6 + offset 6).
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPACT_GAP,
    paddingHorizontal: COMPACT_PADDING_H,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.11)',
    overflow: 'hidden',
  },
  edgeGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    width: COMPACT_CHIP_W,
    height: 19,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 198, 90, 0.85)',
  },
  textCol: { flex: 1, minWidth: 0 },
  bank: { textTransform: 'uppercase', letterSpacing: 1 },
  last4: { marginTop: 3 },
});
