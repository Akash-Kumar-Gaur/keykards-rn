/**
 * Toggle — pill switch with a spring-based thumb slide (Reanimated).
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

const WIDTH = 52;
const HEIGHT = 30;
const PAD = 3;
const THUMB = HEIGHT - PAD * 2;

export function Toggle({ value, onChange, disabled = false }: ToggleProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const anim = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    anim.value = reduced
      ? withTiming(value ? 1 : 0, { duration: 120 })
      : withSpring(value ? 1 : 0, motion.springConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: anim.value * (WIDTH - THUMB - PAD * 2) }],
  }));

  const off = palette.trackBg;
  const on = palette.indigo;
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(anim.value, [0, 1], [off, on]),
  }), [off, on]);

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, trackStyle, disabled && styles.disabled]}>
        <Animated.View
          style={[styles.thumb, { backgroundColor: palette.white }, thumbStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  disabled: { opacity: 0.5 },
});
