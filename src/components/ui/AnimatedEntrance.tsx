/**
 * AnimatedEntrance — fade + slide-up entrance that runs exactly ONCE on mount
 * (not on re-render) and respects the OS reduce-motion setting.
 *
 * Driven entirely on the UI thread via Reanimated. When reduce-motion is on,
 * children appear immediately at their final position with no animation.
 */

import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motion } from '@/theme';

interface AnimatedEntranceProps {
  children: React.ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  /** Distance (px) to travel upward into place. */
  offsetY?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedEntrance({
  children,
  delay = 0,
  offsetY = 16,
  duration = motion.entranceDuration,
  style,
}: AnimatedEntranceProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    // Run once on mount; intentionally exclude deps so it never replays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offsetY }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
