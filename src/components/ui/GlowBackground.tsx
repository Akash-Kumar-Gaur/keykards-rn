/**
 * GlowBackground — navy/warm-white base + radial glow with pulse + slow drift.
 * Intensity follows theme (much softer on light canvas).
 */

import React, { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  accentColor?: string;
  accentDeep?: string;
};

export function GlowBackground({
  accentColor,
  accentDeep,
}: Props = {}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const pulse = useSharedValue(0.5);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const gradId = useId().replace(/:/g, '');

  const core = accentColor ?? palette.indigo;
  const mid = accentDeep ?? palette.indigoDeep;
  const intensity = palette.glowIntensity;

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.65;
      driftX.value = 0;
      driftY.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.8, {
        duration: motion.glowCycle / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    driftX.value = withRepeat(
      withSequence(
        withTiming(28, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-22, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    driftY.value = withRepeat(
      withSequence(
        withTiming(18, { duration: 6500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-14, { duration: 6500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * intensity,
    transform: [{ translateX: driftX.value }, { translateY: driftY.value }],
  }));

  const glowSize = width * 1.6;
  const fillUrl = useMemo(() => `url(#${gradId})`, [gradId]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.base, { backgroundColor: palette.navy950 }]} />
      <Animated.View
        style={[
          styles.glowContainer,
          { width: glowSize, height: glowSize, left: (width - glowSize) / 2 },
          glowStyle,
        ]}
      >
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={core} stopOpacity={0.55 * intensity + 0.1} />
              <Stop offset="45%" stopColor={mid} stopOpacity={0.22 * intensity} />
              <Stop offset="100%" stopColor={core} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={glowSize} height={glowSize} fill={fillUrl} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glowContainer: {
    position: 'absolute',
    top: -180,
  },
});
