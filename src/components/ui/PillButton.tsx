/**
 * PillButton — full pill-radius button.
 *  - primary:   solid indigo gradient fill (CTAs)
 *  - ghost:     transparent with a low-opacity outline ("Sign in")
 *
 * Optional `shimmer` adds a subtle highlight sweep that travels across the
 * button every few seconds to draw the eye (used by the "Add your cards" CTA).
 * The sweep respects reduce-motion.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from './AppText';
import { radius, spacing, motion } from '@/theme';
import { useGradients, usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Variant = 'primary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';
type Tone = 'accent' | 'danger';

interface PillButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  /** Accent (indigo) by default; 'danger' for destructive confirmations. */
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  shimmer?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<Size, { pv: number; ph: number; font: 'small' | 'body' | 'bodyLg' }> = {
  sm: { pv: 8, ph: 16, font: 'small' },
  md: { pv: 12, ph: 20, font: 'body' },
  lg: { pv: 17, ph: 24, font: 'bodyLg' },
};

const SHIMMER_WIDTH = 56;
/** Full left→right sweep duration; loops with no dwell. */
const SHIMMER_SWEEP_MS = 1800;

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  tone = 'accent',
  icon,
  fullWidth = false,
  shimmer = false,
  loading = false,
  disabled = false,
  style,
}: PillButtonProps) {
  const palette = usePalette();
  const gradients = useGradients();
  const reduced = useReducedMotion();
  const sweep = useSharedValue(-SHIMMER_WIDTH);
  const press = useSharedValue(1);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!shimmer || reduced || width === 0) return;

    cancelAnimation(sweep);
    sweep.value = -SHIMMER_WIDTH;
    // Continuous loop: sweep across, snap back, repeat — no pause segment.
    sweep.value = withRepeat(
      withTiming(width + SHIMMER_WIDTH, {
        duration: SHIMMER_SWEEP_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(sweep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shimmer, reduced, width]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value }, { rotate: '18deg' }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    // Avoid restarting the loop on tiny layout noise.
    if (Math.abs(next - width) > 1) setWidth(next);
  };

  const { pv, ph, font } = SIZE_MAP[size];
  const isPrimary = variant === 'primary';
  const isDanger = tone === 'danger';
  const textColor = isPrimary
    ? palette.textOnAccent
    : isDanger
      ? palette.danger
      : palette.textPrimary;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={18} color={textColor} style={styles.icon} />
          ) : null}
          <AppText variant={font} color={textColor} style={styles.label}>
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      onPressIn={() => {
        if (reduced) return;
        press.value = withTiming(0.96, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, motion.springConfig);
      }}
      onLayout={onLayout}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        !isPrimary && {
          borderWidth: 1,
          borderColor: palette.glassBorderStrong,
          backgroundColor: palette.glassFill,
        },
        !isPrimary &&
          isDanger && {
            borderColor: palette.danger,
            backgroundColor: palette.dangerSoft,
          },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      <Animated.View
        style={[
          pressStyle,
          { opacity: disabled ? 0.5 : 1, borderRadius: radius.pill, overflow: 'hidden' },
        ]}
      >
        {isPrimary ? (
          <LinearGradient
            colors={isDanger ? [...gradients.danger] : [...gradients.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fill, { paddingVertical: pv, paddingHorizontal: ph }]}
          >
            {content}
            {shimmer ? (
              <Animated.View style={[styles.shimmer, sweepStyle]} pointerEvents="none">
                <LinearGradient
                  colors={[...gradients.shimmer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}
          </LinearGradient>
        ) : (
          <View style={[styles.fill, { paddingVertical: pv, paddingHorizontal: ph }]}>
            {content}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fullWidth: { alignSelf: 'stretch' },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  icon: { marginRight: 2 },
  label: {},
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: SHIMMER_WIDTH,
    opacity: 0.55,
  },
});
