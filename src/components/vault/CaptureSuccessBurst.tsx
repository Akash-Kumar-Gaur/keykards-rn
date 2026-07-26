/**
 * CaptureSuccessBurst — spring checkmark in a glowing ring (shared by NFC /
 * future scan success). Plays once then calls onDone.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function CaptureSuccessBurst({
  title = 'Card read',
  subtitle,
  onDone,
}: {
  title?: string;
  subtitle?: string;
  onDone?: () => void;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const scale = useSharedValue(0);
  const ring = useSharedValue(0.7);
  const fade = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduced) {
      scale.value = 1;
      fade.value = 1;
      ring.value = 1.2;
      const t = setTimeout(() => onDone?.(), 450);
      return () => clearTimeout(t);
    }
    fade.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, motion.springConfig);
    ring.value = withTiming(1.45, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    const t = setTimeout(() => onDone?.(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const coreStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1.45 - ring.value),
    transform: [{ scale: ring.value }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.burst}>
        <Animated.View style={[styles.ring, { borderColor: palette.green }, ringStyle]} />
        <Animated.View style={[styles.core, { backgroundColor: palette.green }, coreStyle]}>
          <Ionicons name="checkmark" size={40} color={palette.textOnAccent} />
        </Animated.View>
      </View>
      <Animated.View style={coreStyle}>
        <AppText variant="h2" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color={palette.textSecondary} style={styles.sub}>
            {subtitle}
          </AppText>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 20 },
  burst: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  core: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
});
