/**
 * AnimatedSplashReveal — post-native-splash handoff.
 *
 * Uses a Text wordmark (not a PNG) so there is never a white image box.
 * Fades/scales in via Reanimated, then calls onFinished. Respects reduce-motion.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

interface AnimatedSplashRevealProps {
  onFinished: () => void;
}

export function AnimatedSplashReveal({ onFinished }: AnimatedSplashRevealProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const exit = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      onFinished();
      return;
    }

    opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });

    exit.value = withDelay(
      720,
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(onFinished)();
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * exit.value,
    transform: [{ scale: scale.value }],
  }));

  const rootStyle = useAnimatedStyle(() => ({
    opacity: exit.value,
  }));

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: palette.navy950 }, rootStyle]}
      pointerEvents="none"
    >
      <GlowBackground />
      <View style={styles.center}>
        <Animated.View style={[styles.brand, logoStyle]}>
          <Eyebrow color={palette.indigo}>Your wallet, upgraded</Eyebrow>
          <AppText variant="display" style={styles.wordmark}>
            KeyKards
          </AppText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    letterSpacing: -0.8,
  },
});
