/**
 * RevealAffordance — a small pulsing "Tap to reveal" lock pill overlaid on the
 * hero flip-card so it never reads as a static image. Purely decorative
 * (pointerEvents none — taps pass through to the flip card) and fades out once
 * the card is revealed. Reads the same sensitive store the flip card writes to.
 *
 * BADGE ZONE: this is the one indicator allowed to overlay a card face, and it
 * occupies ZONE_BOTTOM_CENTER only. The `zone` wrapper reserves horizontal
 * gutters for ZONE_BOTTOM_LEFT (expiry) and ZONE_BOTTOM_RIGHT (network mark) so
 * the pill can never grow into them on a narrow device. Anything else that needs
 * to sit on a card face goes through CardFace's statusSlot instead — see
 * components/vault/cardBadgeZones.tsx.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { REVEAL_AFFORDANCE_GUTTER } from '@/lib/badgeZones';
import { radius, spacing } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSensitiveStore } from '@/stores/sensitiveStore';

export function RevealAffordance({ cardId }: { cardId: string }) {
  const reduced = useReducedMotion();
  const revealed = useSensitiveStore((s) => s.revealed);
  const isRevealed = Boolean(
    revealed[`${cardId}:pan`] || revealed[`${cardId}:cvv`],
  );

  const pulse = useSharedValue(0.6);
  const visible = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.85;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    visible.value = withTiming(isRevealed ? 0 : 1, { duration: 240 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed]);

  const style = useAnimatedStyle(() => ({
    opacity: visible.value * (0.75 + pulse.value * 0.25),
    transform: [{ scale: 0.96 + pulse.value * 0.04 }],
  }));

  return (
    <View pointerEvents="none" style={styles.zone}>
      <Animated.View style={[styles.pill, style]}>
        <Ionicons name="lock-closed" size={13} color="#FFFFFF" />
        <AppText variant="caption" color="#FFFFFF" numberOfLines={1}>
          Tap to reveal
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Gutters reserved for the card's own bottom-left / bottom-right badges. */
  zone: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.xl + REVEAL_AFFORDANCE_GUTTER,
    right: spacing.xl + REVEAL_AFFORDANCE_GUTTER,
    alignItems: 'center',
  },
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 10, 20, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
