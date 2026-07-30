/**
 * VaultListCard — full-width compact metallic row for the Vault list.
 * Left: bank + nickname (+ optional STATUS slot). Right: last four + network.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { CardMaterialOverlay } from '@/components/vault/CardMaterialOverlay';
import { OneShotShimmer } from '@/components/ui/OneShotShimmer';
import { getCardTheme } from '@/lib/cardThemes';
import { cardGlowAccent } from '@/components/vault/CardThemeGlow';
import { VAULT_ROW_HEIGHT, vaultRowStagger } from '@/lib/vaultDensity';
import { radius, spacing, motion } from '@/theme';
import { useAppTheme } from '@/providers/AppThemeProvider';
import { useCardCanvasElevation } from '@/hooks/useCardCanvasElevation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VaultCard } from '@/types/card';

function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  if (raw.length < 6) return 0;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function VaultListCard({
  card,
  index,
  onPress,
  onLongPress,
  statusSlot,
  selectionMode = false,
  selected = false,
}: {
  card: VaultCard;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
  /** Optional ZONE_STATUS content (sync etc.) — kept in-flow under nickname. */
  statusSlot?: React.ReactNode;
  selectionMode?: boolean;
  selected?: boolean;
}) {
  const reduced = useReducedMotion();
  const { isLight, palette } = useAppTheme();
  const canvasElevation = useCardCanvasElevation();
  const theme = getCardTheme(card.cardColorTheme);
  const accent = cardGlowAccent(card.cardColorTheme);
  const onLightFace = luminance(theme.colors[0]) > 0.58;
  const primary = onLightFace ? 'rgba(18,18,28,0.92)' : '#FFFFFF';
  const muted = onLightFace ? 'rgba(18,18,28,0.55)' : 'rgba(255,255,255,0.7)';

  const press = useSharedValue(0);
  const enter = useSharedValue(0);
  const selectAnim = useSharedValue(selectionMode ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      vaultRowStagger(index),
      withSpring(1, { damping: 16, stiffness: 170, mass: 0.85 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, index]);

  useEffect(() => {
    selectAnim.value = reduced
      ? selectionMode
        ? 1
        : 0
      : withSpring(selectionMode ? 1 : 0, motion.springConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionMode, reduced]);

  const enterStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1 };
    return {
      opacity: enter.value,
      transform: [
        { translateY: (1 - enter.value) * 18 },
        { scale: 0.97 + enter.value * 0.03 },
      ],
    };
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: selectAnim.value,
    transform: [{ scale: 0.7 + selectAnim.value * 0.3 }],
    width: 28 * selectAnim.value,
    marginRight: 8 * selectAnim.value,
  }));

  const setPressed = (v: number) => {
    press.value = reduced ? v : withSpring(v, motion.springConfig);
  };

  return (
    <Animated.View style={enterStyle}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={380}
        onPressIn={() => setPressed(1)}
        onPressOut={() => setPressed(0)}
        accessibilityRole="button"
        accessibilityState={{ selected: selectionMode ? selected : undefined }}
        accessibilityLabel={`${card.nickname}, ${card.bankName}, ending ${card.lastFour}`}
      >
        <Animated.View
          style={[
            styles.shadowWrap,
            { backgroundColor: theme.colors[0] },
            isLight
              ? canvasElevation
              : {
                  shadowColor: accent,
                  shadowOpacity: 0.28,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                },
            selected && {
              borderWidth: 2,
              borderColor: palette.indigo,
            },
            pressStyle,
          ]}
        >
          <LinearGradient
            colors={[...theme.colors]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <CardMaterialOverlay />
            <View style={styles.shimmerClip} pointerEvents="none">
              <OneShotShimmer delay={vaultRowStagger(index) + 360} />
            </View>

            <Animated.View style={[styles.checkWrap, checkStyle]}>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={selected ? palette.indigo : 'rgba(255,255,255,0.85)'}
              />
            </Animated.View>

            <View style={styles.left}>
              <AppText
                variant="caption"
                color={muted}
                style={styles.bank}
                numberOfLines={1}
              >
                {card.bankName || 'Bank'}
              </AppText>
              <AppText variant="title" color={primary} numberOfLines={1}>
                {card.nickname}
              </AppText>
              {statusSlot ? <View style={styles.statusZone}>{statusSlot}</View> : null}
            </View>

            <View style={styles.right}>
              <AppText variant="small" color={primary} style={styles.last4}>
                •••• {card.lastFour}
              </AppText>
              <AppText variant="caption" color={muted} style={styles.network}>
                {card.network}
              </AppText>
            </View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.lg,
    borderWidth: 0,
  },
  card: {
    height: VAULT_ROW_HEIGHT,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  checkWrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  left: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bank: {
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  statusZone: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  last4: {
    letterSpacing: 0.6,
  },
  network: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
