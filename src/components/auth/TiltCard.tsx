/**
 * TiltCard — tactile hero card for Sign in. Pan gesture drives clamped
 * rotateX/rotateY; a gloss highlight follows the tilt. Reduce-motion: static.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { CardMaterialOverlay } from '@/components/vault/CardMaterialOverlay';
import { radius, spacing, motion } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const MAX_TILT = 12;

export function TiltCard() {
  const reduced = useReducedMotion();
  const rotX = useSharedValue(0);
  const rotY = useSharedValue(0);
  const glossX = useSharedValue(0.5);
  const glossY = useSharedValue(0.35);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateX: `${reduced ? 0 : rotX.value}deg` },
      { rotateY: `${reduced ? 0 : rotY.value}deg` },
    ],
  }));

  const glossStyle = useAnimatedStyle(() => ({
    left: `${(reduced ? 0.5 : glossX.value) * 70}%`,
    top: `${(reduced ? 0.35 : glossY.value) * 50}%`,
  }));

  const pan = Gesture.Pan()
    .enabled(!reduced)
    .onChange((e) => {
      const nextY = Math.max(-MAX_TILT, Math.min(MAX_TILT, e.translationX / 12));
      const nextX = Math.max(-MAX_TILT, Math.min(MAX_TILT, -e.translationY / 12));
      rotY.value = nextY;
      rotX.value = nextX;
      glossX.value = 0.5 + nextY / (MAX_TILT * 2);
      glossY.value = 0.35 + nextX / (MAX_TILT * 2);
    })
    .onFinalize(() => {
      rotX.value = withSpring(0, motion.springConfig);
      rotY.value = withSpring(0, motion.springConfig);
      glossX.value = withSpring(0.5, motion.springConfig);
      glossY.value = withSpring(0.35, motion.springConfig);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        <LinearGradient
          colors={['#6C5CE7', '#3D348B', '#1A1638']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <CardMaterialOverlay />
        {!reduced ? (
          <Animated.View style={[styles.gloss, glossStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        <View style={styles.chip} />
        <Eyebrow color="rgba(255,255,255,0.7)">InWallet</Eyebrow>
        <AppText variant="title" color="#FFFFFF" style={styles.name}>
          Your wallet
        </AppText>
        <AppText variant="small" color="rgba(255,255,255,0.55)">
          Drag to tilt
        </AppText>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    height: 168,
    borderRadius: radius.xl,
    padding: spacing.xl,
    justifyContent: 'flex-end',
    gap: spacing.xs,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  gloss: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  chip: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.xl,
    width: 28,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  name: { marginTop: 2 },
});
