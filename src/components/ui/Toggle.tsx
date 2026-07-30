/**
 * Toggle — pill switch with a spring-based thumb slide (Reanimated).
 * Theme variant embeds moon/sun glyphs in the track.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
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
  /** Moon (off) / sun (on) glyphs for theme switches. */
  variant?: 'default' | 'theme';
  accessibilityLabel?: string;
}

const HEIGHT = 30;
const PAD = 3;
const THUMB = HEIGHT - PAD * 2;
const WIDTH_DEFAULT = 52;
const WIDTH_THEME = 56;

export function Toggle({
  value,
  onChange,
  disabled = false,
  variant = 'default',
  accessibilityLabel,
}: ToggleProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const anim = useSharedValue(value ? 1 : 0);
  const isTheme = variant === 'theme';
  const width = isTheme ? WIDTH_THEME : WIDTH_DEFAULT;
  const travel = width - THUMB - PAD * 2;

  useEffect(() => {
    anim.value = reduced
      ? withTiming(value ? 1 : 0, { duration: 120 })
      : withSpring(value ? 1 : 0, motion.springConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: anim.value * travel }],
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
      accessibilityLabel={
        accessibilityLabel ??
        (isTheme ? (value ? 'Light theme' : 'Dark theme') : undefined)
      }
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.track,
          { width },
          trackStyle,
          disabled && styles.disabled,
        ]}
      >
        {isTheme ? (
          <>
            <View style={[styles.glyph, styles.glyphLeft]} pointerEvents="none">
              <Ionicons
                name="moon"
                size={12}
                color={value ? 'rgba(255,255,255,0.55)' : palette.textTertiary}
              />
            </View>
            <View style={[styles.glyph, styles.glyphRight]} pointerEvents="none">
              <Ionicons
                name="sunny"
                size={12}
                color={value ? palette.textOnAccent : palette.textTertiary}
              />
            </View>
          </>
        ) : null}
        <Animated.View
          style={[styles.thumb, { backgroundColor: palette.white }, thumbStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PAD,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyph: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  glyphLeft: {
    left: 4,
  },
  glyphRight: {
    right: 4,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    zIndex: 1,
  },
  disabled: { opacity: 0.5 },
});
