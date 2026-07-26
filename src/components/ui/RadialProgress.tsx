/**
 * RadialProgress — animated SVG progress ring (starts at 12 o'clock, clockwise).
 * Optional accent colors for Track card-scope theming.
 */

import React, { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RadialProgressProps {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  /** Start the fill animation (e.g. when scrolled into view). */
  play?: boolean;
  /** Pulse a dot at the unlock (100%) point along the track. */
  showUnlockPulse?: boolean;
  /** Ring gradient start — defaults to indigo. */
  color?: string;
  /** Ring gradient end — defaults to indigoDeep. */
  colorDeep?: string;
  children?: React.ReactNode;
}

export function RadialProgress({
  progress,
  size = 176,
  strokeWidth = 14,
  play = true,
  showUnlockPulse = true,
  color,
  colorDeep,
  children,
}: RadialProgressProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const ringColor = color ?? palette.indigo;
  const ringDeep = colorDeep ?? palette.indigoDeep;
  const target = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gradId = useId().replace(/:/g, '');

  const fill = useSharedValue(0);
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    if (!play) return;
    fill.value = reduced
      ? target
      : withTiming(target, {
          duration: motion.progressDuration,
          easing: Easing.out(Easing.cubic),
        });
    if (!reduced) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      pulse.value = 0.85;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced, target]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: target > 0 ? pulse.value : 0.3,
    transform: [{ scale: 0.7 + pulse.value * 0.5 }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={ringColor} />
            <Stop offset="100%" stopColor={ringDeep} />
          </LinearGradient>
        </Defs>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={palette.trackBg}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={r}
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      {showUnlockPulse ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.unlockDot,
            {
              left: cx - 6,
              top: (strokeWidth - 12) / 2,
              shadowColor: ringColor,
              backgroundColor: palette.white,
            },
            pulseStyle,
          ]}
        />
      ) : null}

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  unlockDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
