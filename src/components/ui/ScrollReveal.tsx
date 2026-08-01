/**
 * ScrollReveal — scroll-triggered fade+slide entrance for long screens.
 *
 * A provider holds the scroll offset + viewport height (shared values). Each
 * ScrollReveal (or the useScrollReveal hook) measures its own Y within the
 * scroll content and animates in once it enters the viewport — once only,
 * never reversing. Falls back to immediate show when used outside a provider.
 */

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
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
/**
 * Content is never allowed to stay invisible because a layout measurement or a
 * scroll event never reached the UI thread. Past this point the reveal happens
 * regardless of scroll position.
 */
const FAILSAFE_MS = 2500;

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
  const windowH = useWindowDimensions().height;
  const y = useSharedValue(-1);
  const shown = useSharedValue(0);
  /** One-shot latch: re-running the reaction must not restart the animation. */
  const armed = useSharedValue(false);

  const scrollY = ctx?.scrollY;
  const viewportH = ctx?.viewportH;

  const shownRef = useRef(onShown);
  shownRef.current = onShown;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useAnimatedReaction(
    () => {
      if (!scrollY || !viewportH) return true; // no provider → reveal now
      if (y.value < 0) return false;
      // The ScrollView may not have reported its height yet; the window is a
      // safe upper bound rather than a reason to stay hidden.
      const height = viewportH.value > 0 ? viewportH.value : windowH;
      return scrollY.value + height * TRIGGER > y.value;
    },
    (visible) => {
      if (!visible || armed.value) return;
      armed.value = true;
      shown.value = reduced ? 1 : withDelay(delay, withSpring(1, SPRING));
      if (onShown) runOnJS(onShown)();
    },
    [reduced, delay, windowH],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (armed.value) return;
      armed.value = true;
      shown.value = reducedRef.current ? 1 : withSpring(1, SPRING);
      shownRef.current?.();
    }, FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [armed, shown]);

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
