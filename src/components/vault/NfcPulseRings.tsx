/**
 * NfcPulseRings — radiating rings + NFC icon for the Tap-to-read screen.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

function Ring({ delay, size, borderColor }: { delay: number; size: number; borderColor: string }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 0.35;
      return;
    }
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: (1 - progress.value) * 0.55,
    transform: [{ scale: 0.55 + progress.value * 0.9 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor },
        style,
      ]}
    />
  );
}

export function NfcPulseRings() {
  const palette = usePalette();
  return (
    <View style={styles.wrap}>
      <Ring delay={0} size={220} borderColor={palette.indigo} />
      <Ring delay={700} size={220} borderColor={palette.indigo} />
      <Ring delay={1400} size={220} borderColor={palette.indigo} />
      <View
        style={[
          styles.core,
          {
            backgroundColor: palette.indigoSoft,
            borderColor: palette.glassBorderStrong,
          },
        ]}
      >
        <Ionicons name="wifi" size={42} color={palette.indigo} style={styles.iconFlip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  core: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // wifi glyph sideways reads as an NFC/contactless mark
  iconFlip: { transform: [{ rotate: '90deg' }] },
});
