/**
 * VaultSwipeableRow — swipe left to reveal a destructive action; exclusive open
 * via parent. Reduced-motion: same reveal via timing (still swipeable).
 * Disabled entirely while selection mode is active.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { VAULT_ROW_HEIGHT } from '@/lib/vaultDensity';

const ACTION_W = 88;
const OPEN_X = -ACTION_W;
const THRESHOLD = ACTION_W * 0.45;

type Props = {
  rowId: string;
  openRowId: string | null;
  onOpenChange: (id: string | null) => void;
  onActionPress: () => void;
  /** When true, swipe is disabled (selection mode). */
  disabled?: boolean;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionAccessibilityLabel?: string;
  children: React.ReactNode;
};

export function VaultSwipeableRow({
  rowId,
  openRowId,
  onOpenChange,
  onActionPress,
  disabled = false,
  actionLabel = 'Delete',
  actionIcon = 'trash-outline',
  actionAccessibilityLabel,
  children,
}: Props) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const isOpen = openRowId === rowId;

  useEffect(() => {
    const target = isOpen ? OPEN_X : 0;
    x.value = reduced
      ? withTiming(target, { duration: 140 })
      : withSpring(target, motion.springConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reduced]);

  const close = () => onOpenChange(null);
  const open = () => onOpenChange(rowId);
  const hapticLight = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      startX.value = x.value;
    })
    .onUpdate((e) => {
      const next = Math.min(0, Math.max(OPEN_X, startX.value + e.translationX));
      x.value = next;
    })
    .onEnd((e) => {
      const shouldOpen =
        x.value < -THRESHOLD || (e.velocityX < -400 && x.value < OPEN_X * 0.2);
      if (shouldOpen) {
        runOnJS(hapticLight)();
        runOnJS(open)();
        x.value = reduced
          ? withTiming(OPEN_X, { duration: 140 })
          : withSpring(OPEN_X, motion.springConfig);
      } else {
        runOnJS(close)();
        x.value = reduced
          ? withTiming(0, { duration: 140 })
          : withSpring(0, motion.springConfig);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer} pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onActionPress();
          }}
          style={[styles.actionBtn, { backgroundColor: palette.danger }]}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        >
          <Ionicons name={actionIcon} size={22} color={palette.textOnAccent} />
          <AppText variant="caption" color={palette.textOnAccent}>
            {actionLabel}
          </AppText>
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.foreground, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  actionLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  actionBtn: {
    width: ACTION_W,
    minHeight: VAULT_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  foreground: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
