/**
 * CardMorphTarget — destination half of the scan → form card hand-off.
 *
 * Reports where the wrapped preview actually landed (window coordinates) so
 * `CardMorphOverlay` knows what to animate towards, and keeps the real preview
 * hidden until the overlay hands back, so only one card is ever visible.
 *
 * Renders children untouched when no morph is in flight, which is the case for
 * every entry into the form other than a completed scan.
 */

import React, { useCallback, useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCardMorphStore } from '@/stores/cardMorphStore';

const FADE_MS = 150;

export function CardMorphTarget({
  children,
  style,
  enabled = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Only the screen a scan can actually hand off to should claim the card. */
  enabled?: boolean;
}) {
  const phase = useCardMorphStore((s) => s.phase);
  const ref = React.useRef<View>(null);

  const hidden = enabled && (phase === 'pending' || phase === 'running');
  const opacity = useSharedValue(hidden ? 0 : 1);

  useEffect(() => {
    opacity.value = withTiming(hidden ? 0 : 1, { duration: FADE_MS });
  }, [hidden, opacity]);

  // Read the phase imperatively — this can fire on any layout pass, long after
  // the hand-off is over, and we only want the first measurement.
  const measure = useCallback(() => {
    if (!enabled) return;
    if (useCardMorphStore.getState().phase !== 'pending') return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        useCardMorphStore.getState().setTarget({ x, y, width, height });
      }
    });
  }, [enabled]);

  // onLayout fires before the enclosing scroll view has settled, so measure on
  // the following frame to get the resting position.
  const onLayout = useCallback(() => {
    requestAnimationFrame(measure);
  }, [measure]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View ref={ref} onLayout={onLayout} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
