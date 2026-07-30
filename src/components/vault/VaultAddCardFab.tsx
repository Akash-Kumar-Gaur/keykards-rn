/**
 * VaultAddCardFab — circular indigo "+" above the tab bar.
 * Subtle idle pulse + scale bump on press (respects reduce-motion).
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius, shadow, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SIZE = 56;

export function VaultAddCardFab({
  bottom,
  onPress,
}: {
  bottom: number;
  onPress: () => void;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * press.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, { bottom }, wrapStyle]}>
      <Pressable
        onPressIn={() => {
          press.value = reduced
            ? withTiming(0.92, { duration: 80 })
            : withSpring(0.9, { damping: 14, stiffness: 320 });
        }}
        onPressOut={() => {
          press.value = reduced
            ? withTiming(1, { duration: 120 })
            : withSpring(1, { damping: 12, stiffness: 260 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        style={[styles.fab, { backgroundColor: palette.indigo }]}
        accessibilityRole="button"
        accessibilityLabel="Add card"
      >
        <Ionicons name="add" size={28} color={palette.textOnAccent} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.xl,
    zIndex: 20,
    ...shadow.accent,
  },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});
