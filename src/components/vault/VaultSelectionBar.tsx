/**
 * VaultSelectionBar — batch actions while multi-select is active.
 * Sits above the floating tab bar; slides in with reduced-motion-aware timing.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  count: number;
  bottom: number;
  deleting?: boolean;
  onCancel: () => void;
  onDelete: () => void;
};

export function VaultSelectionBar({
  count,
  bottom,
  deleting = false,
  onCancel,
  onDelete,
}: Props) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const y = useSharedValue(80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      y.value = 0;
      opacity.value = 1;
      return;
    }
    y.value = withSpring(0, motion.springConfig);
    opacity.value = withTiming(1, { duration: 220 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          bottom,
          backgroundColor: palette.navy800,
          borderColor: palette.glassBorderStrong,
        },
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${count} selected`}
    >
      <Pressable
        onPress={onCancel}
        hitSlop={8}
        style={styles.cancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel selection"
      >
        <Ionicons name="close" size={22} color={palette.textSecondary} />
      </Pressable>
      <AppText variant="body" style={styles.count}>
        {count} selected
      </AppText>
      <Pressable
        onPress={onDelete}
        disabled={count === 0 || deleting}
        style={[
          styles.delete,
          {
            backgroundColor: palette.danger,
            opacity: count === 0 || deleting ? 0.5 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Delete selected"
      >
        <Ionicons name="trash-outline" size={16} color={palette.textOnAccent} />
        <AppText variant="small" color={palette.textOnAccent}>
          {deleting ? 'Deleting…' : 'Delete'}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  cancel: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { flex: 1, minWidth: 0 },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
