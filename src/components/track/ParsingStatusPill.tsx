/**
 * Lightweight floating pill while clipboard/OCR text is being parsed.
 * Enforces a minimum visible duration so the user perceives work happening.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export type ParsingPillState = 'reading' | 'empty' | 'done' | null;

export function ParsingStatusPill({
  state,
  message,
}: {
  state: ParsingPillState;
  message?: string;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!state) {
      opacity.value = withTiming(0, { duration: 160 });
      return;
    }
    opacity.value = withTiming(1, { duration: 180 });
    if (state === 'reading' && !reduced) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 520, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 160 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: (1 - opacity.value) * -8 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  if (!state) return null;

  const label =
    message ??
    (state === 'reading'
      ? 'Reading transactions…'
      : state === 'empty'
        ? 'Nothing to add'
        : 'Ready');

  const icon: keyof typeof Ionicons.glyphMap =
    state === 'empty'
      ? 'close-circle-outline'
      : state === 'done'
        ? 'checkmark-circle'
        : 'wallet-outline';

  const iconColor =
    state === 'empty'
      ? palette.textTertiary
      : state === 'done'
        ? palette.green
        : palette.indigo;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + spacing.sm }, rootStyle]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: palette.navy850,
            borderColor: palette.glassBorderStrong,
          },
        ]}
      >
        <Animated.View style={iconStyle}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </Animated.View>
        <AppText variant="small" color={palette.textPrimary}>
          {label}
        </AppText>
      </View>
    </Animated.View>
  );
}

/** Floor so fast parses still feel like the app did work. */
export const PARSING_PILL_MIN_MS = 500;

export async function withMinDuration<T>(
  work: Promise<T>,
  minMs = PARSING_PILL_MIN_MS,
): Promise<T> {
  const [result] = await Promise.all([
    work,
    new Promise<void>((r) => setTimeout(r, minMs)),
  ]);
  return result;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
