/**
 * HomeCarouselCard — compact metallic card face for the Home horizontal strip.
 * Shorter than Card Detail hero; bank + masked last-four + network label.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { palette, radius, spacing, motion } from '@/theme';
import { useAppTheme } from '@/providers/AppThemeProvider';
import { useCardCanvasElevation } from '@/hooks/useCardCanvasElevation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VaultCard } from '@/types/card';

export function HomeCarouselCard({
  card,
  width,
  height,
  index,
  delay = 0,
  onPress,
}: {
  card: VaultCard;
  width: number;
  height: number;
  index: number;
  delay?: number;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const { isLight } = useAppTheme();
  const canvasElevation = useCardCanvasElevation();
  const theme = getCardTheme(card.cardColorTheme);
  const accent = cardGlowAccent(card.cardColorTheme);
  const press = useSharedValue(0);
  const enter = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      delay + index * 70,
      withSpring(1, { damping: 16, stiffness: 160, mass: 0.85 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, delay, index]);

  const enterStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1 };
    return {
      opacity: enter.value,
      transform: [
        { translateX: (1 - enter.value) * 56 },
        { scale: 0.94 + enter.value * 0.06 },
      ],
    };
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
  }));

  const setPressed = (v: number) => {
    press.value = reduced
      ? v
      : withSpring(v, motion.springConfig);
  };

  return (
    <Animated.View style={[{ width }, enterStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(1)}
        onPressOut={() => setPressed(0)}
        accessibilityRole="button"
        accessibilityLabel={`${card.bankName} card ending ${card.lastFour}`}
      >
        <Animated.View
          style={[
            styles.shadowWrap,
            { width, height, backgroundColor: theme.colors[0] },
            isLight
              ? canvasElevation
              : {
                  shadowColor: accent,
                  shadowOpacity: 0.32,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 7,
                },
            pressStyle,
          ]}
        >
          <LinearGradient
            colors={[...theme.colors]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { width, height }]}
          >
            <CardMaterialOverlay />
            <View style={styles.shimmerClip} pointerEvents="none">
              <OneShotShimmer delay={delay + index * 70 + 380} />
            </View>

            <AppText
              variant="caption"
              color="rgba(255,255,255,0.72)"
              style={styles.bank}
              numberOfLines={1}
            >
              {card.bankName || 'Bank'}
            </AppText>

            <AppText
              variant="title"
              color={palette.white}
              style={styles.last4}
              numberOfLines={1}
            >
              •••• {card.lastFour}
            </AppText>

            <AppText
              variant="caption"
              color="rgba(255,255,255,0.7)"
              style={styles.network}
              numberOfLines={1}
            >
              {card.network}
            </AppText>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.lg,
  },
  card: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  shimmerClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  bank: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  last4: {
    letterSpacing: 1.5,
    marginVertical: spacing.xs,
  },
  network: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
