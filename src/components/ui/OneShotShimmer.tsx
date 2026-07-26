/**
 * OneShotShimmer — a single gloss band that sweeps across a clipped parent
 * once on mount (card catching light). Not a loop.
 */

import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { gradients } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const BAND = 72;

export function OneShotShimmer({ delay = 600 }: { delay?: number }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-BAND);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reduced || width === 0) return;
    x.value = -BAND;
    x.value = withDelay(
      delay,
      withTiming(width + BAND, { duration: 900, easing: Easing.inOut(Easing.quad) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, width, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={StyleSheet.absoluteFill}
    >
      {!reduced ? (
        <Animated.View style={[styles.band, style]}>
          <LinearGradient
            colors={[...gradients.shimmer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: BAND,
    opacity: 0.55,
  },
});
