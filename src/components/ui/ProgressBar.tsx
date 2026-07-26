/**
 * ProgressBar — fill animates 0→value on mount, with a pulsing glow dot at the
 * leading edge of the fill. Reduce-motion: snap fill, no pulse.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius, motion } from '@/theme';
import { useGradients, usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ProgressBarProps {
  progress: number;
  height?: number;
}

export function ProgressBar({ progress, height = 8 }: ProgressBarProps) {
  const palette = usePalette();
  const gradients = useGradients();
  const reduced = useReducedMotion();
  const value = useSharedValue(0);
  const pulse = useSharedValue(0.6);
  const target = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    if (reduced) {
      value.value = target;
      pulse.value = 0.8;
      return;
    }
    value.value = withTiming(target, {
      duration: motion.progressDuration,
      easing: Easing.out(Easing.cubic),
    });
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, target]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${value.value * 100}%`,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: target <= 0 ? 0 : pulse.value,
    transform: [{ scale: 0.75 + pulse.value * 0.35 }],
  }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: palette.trackBg },
      ]}
    >
      <Animated.View style={[styles.fill, fillStyle]}>
        <LinearGradient
          colors={[...gradients.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]}
        />
        {!reduced && target > 0 ? (
          <Animated.View
            style={[
              styles.dot,
              {
                top: (height - 10) / 2,
                backgroundColor: palette.white,
                shadowColor: palette.indigo,
              },
              dotStyle,
            ]}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    overflow: 'visible',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    right: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
