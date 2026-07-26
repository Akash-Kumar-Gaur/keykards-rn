/**
 * ScrollReveal — scroll-triggered fade+slide entrance for long screens.
 *
 * A provider holds the scroll offset + viewport height (shared values). Each
 * ScrollReveal (or the useScrollReveal hook) measures its own Y within the
 * scroll content and animates in once it enters the viewport — once only,
 * never reversing. Falls back to immediate show when used outside a provider.
 */

import React, { createContext, useContext } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ScrollRevealCtx {
  scrollY: SharedValue<number>;
  viewportH: SharedValue<number>;
}

const Ctx = createContext<ScrollRevealCtx | null>(null);

const SPRING = { damping: 18, stiffness: 170, mass: 0.9 };
/** Reveal when the element's top passes this fraction of the viewport height. */
const TRIGGER = 0.9;

export function ScrollRevealProvider({
  scrollY,
  viewportH,
  children,
}: ScrollRevealCtx & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ scrollY, viewportH }}>{children}</Ctx.Provider>;
}

export function useScrollReveal(opts?: {
  delay?: number;
  onShown?: () => void;
}) {
  const { delay = 0, onShown } = opts ?? {};
  const ctx = useContext(Ctx);
  const reduced = useReducedMotion();
  const y = useSharedValue(-1);
  const shown = useSharedValue(0);

  const scrollY = ctx?.scrollY;
  const viewportH = ctx?.viewportH;

  useAnimatedReaction(
    () => {
      if (!scrollY || !viewportH) return true; // no provider → reveal now
      if (viewportH.value <= 0 || y.value < 0) return false;
      return scrollY.value + viewportH.value * TRIGGER > y.value;
    },
    (visible, prev) => {
      if (visible && shown.value < 1) {
        shown.value = reduced ? 1 : withDelay(delay, withSpring(1, SPRING));
        if (onShown) runOnJS(onShown)();
      }
    },
    [reduced],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    y.value = e.nativeEvent.layout.y;
  };

  return { shown, onLayout };
}

export function ScrollReveal({
  children,
  delay = 0,
  offsetY = 22,
  style,
  onMeasureY,
}: {
  children: React.ReactNode;
  delay?: number;
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
  /** JS callback with layout Y (for scroll-to-section jumps). */
  onMeasureY?: (y: number) => void;
}) {
  const { shown, onLayout } = useScrollReveal({ delay });
  const aStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * offsetY }],
  }));
  return (
    <Animated.View
      style={[style, aStyle]}
      onLayout={(e) => {
        onLayout(e);
        onMeasureY?.(e.nativeEvent.layout.y);
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * RevealSection — like ScrollReveal, but exposes a `play` boolean (via render
 * prop) that flips true once the section enters the viewport, so children can
 * kick off count-ups / staggered fills exactly when they become visible.
 */
export function RevealSection({
  children,
  delay = 0,
  offsetY = 22,
  style,
  onMeasureY,
}: {
  children: (play: boolean) => React.ReactNode;
  delay?: number;
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
  onMeasureY?: (y: number) => void;
}) {
  const [play, setPlay] = React.useState(false);
  const { shown, onLayout } = useScrollReveal({
    delay,
    onShown: () => setPlay(true),
  });
  const aStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * offsetY }],
  }));
  return (
    <Animated.View
      style={[style, aStyle]}
      onLayout={(e) => {
        onLayout(e);
        onMeasureY?.(e.nativeEvent.layout.y);
      }}
    >
      {children(play)}
    </Animated.View>
  );
}
