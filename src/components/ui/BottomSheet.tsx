/**
 * BottomSheet — lightweight glass bottom sheet over a react-native Modal.
 * Spring slide-up + scrim fade, respects reduce-motion, tap-scrim to close.
 *
 * Keyboard: Modal is outside the root KeyboardProvider tree for event
 * delivery on some platforms, so we nest KeyboardProvider here and lift the
 * sheet with KeyboardAvoidingView (same react-native-keyboard-controller
 * stack as Sign In / CardForm), so text fields stay above the keyboard.
 */

import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from 'react-native-keyboard-controller';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const sheetH = useSharedValue(280);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reduced
        ? withTiming(1, { duration: 120 })
        : withSpring(1, { damping: 20, stiffness: 220, mass: 0.9 });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, onClose]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetH.value }],
    opacity: reduced ? progress.value : 1,
  }));

  const onSheetLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) sheetH.value = h;
  };

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Nested provider — RN Modal hosts its own window; root KeyboardProvider
          does not always forward keyboard events into this tree. */}
      <KeyboardProvider statusBarTranslucent>
        <KeyboardAvoidingView
          style={styles.avoid}
          behavior="padding"
          automaticOffset
        >
          <View style={styles.root}>
            <AnimatedPressable
              style={[
                styles.scrim,
                { backgroundColor: palette.overlayScrim },
                scrimStyle,
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
            <Animated.View
              style={[
                styles.sheet,
                {
                  paddingBottom: insets.bottom + spacing.lg,
                  backgroundColor: palette.navy850,
                  borderColor: palette.glassBorderStrong,
                },
                sheetStyle,
              ]}
              onLayout={onSheetLayout}
            >
              <View
                style={[
                  styles.handle,
                  { backgroundColor: palette.glassBorderStrong },
                ]}
              />
              {children}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </KeyboardProvider>
    </Modal>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  avoid: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
});

export const SHEET_SPRING = motion.springConfig;
