/**
 * TIER 3 — DENSE LIST (8+ cards).
 * Row-based, not card-shaped: a slim themed accent strip, small network mark,
 * nickname + bank, masked last four. Glass panel fill only — no per-row glow.
 *
 * Interaction is a row highlight (background lightens), no press-scale.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { NetworkBadge } from '@/components/vault/NetworkBadge';
import { GlassSurface } from '@/components/vault/GlassSurface';
import { getCardTheme } from '@/lib/cardThemes';
import {
  DENSE_ACCENT_W,
  DENSE_GAP,
  DENSE_LAST4_W,
  DENSE_PADDING_H,
} from '@/lib/badgeZones';
import { radius } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { VaultCard } from '@/types/card';

export function VaultDenseRow({
  card,
  height,
  blur = false,
  onPress,
}: {
  card: VaultCard;
  height: number;
  /** Backdrop blur — the caller disables it on very long lists (scroll cost). */
  blur?: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const highlight = useSharedValue(0);
  const theme = getCardTheme(card.cardColorTheme);

  const setHighlighted = (on: boolean) => {
    highlight.value = withTiming(on ? 1 : 0, { duration: on ? 90 : 160 });
  };

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlight.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setHighlighted(true)}
      onPressOut={() => setHighlighted(false)}
      accessibilityRole="button"
      accessibilityLabel={`${card.nickname}, ${card.bankName}, ending ${card.lastFour}`}
    >
      <GlassSurface
        cornerRadius={radius.md}
        blur={blur}
        blurIntensity={14}
        style={[styles.row, { height }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.rowHighlight, highlightStyle]}
        />

        <LinearGradient
          colors={[...theme.colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.accent}
        />

        <View style={styles.content}>
          <NetworkBadge network={card.network} size="sm" />
          <View style={styles.textCol}>
            <AppText variant="small" numberOfLines={1}>
              {card.nickname}
            </AppText>
            <AppText variant="caption" color={palette.textTertiary} numberOfLines={1}>
              {card.bankName}
            </AppText>
          </View>
          <AppText
            variant="caption"
            color={palette.textSecondary}
            style={styles.last4}
          >
            •••• {card.lastFour}
          </AppText>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
  },
  rowHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DENSE_ACCENT_W,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DENSE_GAP,
    paddingHorizontal: DENSE_PADDING_H,
    paddingLeft: DENSE_PADDING_H + DENSE_ACCENT_W,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  last4: {
    width: DENSE_LAST4_W,
    textAlign: 'right',
  },
});
