/**
 * FloatingCardStack — 3 mini card silhouettes that fly in (spring) then bob
 * independently (Y + slight rotation). Used behind Home headlines and faintly
 * behind Sign in. Reduce-motion: settle instantly, no loops.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardMaterialOverlay } from '@/components/vault/CardMaterialOverlay';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius } from '@/theme';
import { useCardCanvasElevation } from '@/hooks/useCardCanvasElevation';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface CardSpec {
  width: number;
  height: number;
  left: number;
  top: number;
  settleRotate: number;
  fromX: number;
  fromY: number;
  bobAmp: number;
  bobRotate: number;
  bobDuration: number;
  enterDelay: number;
  opacity: number;
  colors: readonly [string, string];
}

const CARDS: CardSpec[] = [
  {
    width: 118,
    height: 74,
    left: -8,
    top: 28,
    settleRotate: -14,
    fromX: -160,
    fromY: 40,
    bobAmp: 7,
    bobRotate: 2.5,
    bobDuration: 3200,
    enterDelay: 80,
    opacity: 0.9,
    colors: ['#6C5CE7', '#3D348B'],
  },
  {
    width: 132,
    height: 82,
    left: 98,
    top: 0,
    settleRotate: 8,
    fromX: 180,
    fromY: -50,
    bobAmp: 9,
    bobRotate: -2,
    bobDuration: 3800,
    enterDelay: 180,
    opacity: 1,
    colors: ['#5B4FE0', '#2A2458'],
  },
  {
    width: 108,
    height: 68,
    left: 52,
    top: 72,
    settleRotate: 4,
    fromX: 40,
    fromY: 140,
    bobAmp: 6,
    bobRotate: 1.8,
    bobDuration: 2800,
    enterDelay: 280,
    opacity: 0.75,
    colors: ['#8B7CF7', '#4A3FA0'],
  },
];

function FloatingCard({
  spec,
  reduced,
  dim,
}: {
  spec: CardSpec;
  reduced: boolean;
  dim: number;
}) {
  const cardElevation = useCardCanvasElevation();
  const progress = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      spec.enterDelay,
      withSpring(1, { damping: 14, stiffness: 120, mass: 0.85 }),
    );
    bob.value = withDelay(
      spec.enterDelay + 500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: spec.bobDuration / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: spec.bobDuration / 2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const style = useAnimatedStyle(() => {
    const enterX = (1 - progress.value) * spec.fromX;
    const enterY = (1 - progress.value) * spec.fromY;
    const bobY = reduced ? 0 : (bob.value - 0.5) * 2 * spec.bobAmp;
    const bobR = reduced ? 0 : (bob.value - 0.5) * 2 * spec.bobRotate;
    return {
      opacity: progress.value * spec.opacity * dim,
      transform: [
        { translateX: enterX },
        { translateY: enterY + bobY },
        { rotate: `${spec.settleRotate + bobR}deg` },
        { scale: 0.85 + progress.value * 0.15 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.card,
        cardElevation,
        {
          width: spec.width,
          height: spec.height,
          left: spec.left,
          top: spec.top,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[...spec.colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <CardMaterialOverlay />
      <View style={styles.chip} />
      <View style={styles.stripe} />
    </Animated.View>
  );
}

interface FloatingCardStackProps {
  /** 0–1 multiplier for silhouette opacity (Sign in uses a lower value). */
  dim?: number;
  style?: StyleProp<ViewStyle>;
}

export function FloatingCardStack({ dim = 1, style }: FloatingCardStackProps) {
  const reduced = useReducedMotion();
  return (
    <View style={[styles.stack, style]} pointerEvents="none">
      {CARDS.map((spec, i) => (
        <FloatingCard key={i} spec={spec} reduced={reduced} dim={dim} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: 220,
    height: 160,
    alignSelf: 'center',
  },
  card: {
    position: 'absolute',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chip: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 22,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  stripe: {
    position: 'absolute',
    bottom: 14,
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});
