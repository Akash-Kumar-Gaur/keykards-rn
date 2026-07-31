/**
 * CardMorphOverlay — root-level host that carries a card across a route change.
 *
 * Sits above the navigator so it survives the screen swap, then animates the
 * card from the rect the scan framed it in to the rect the add-card form's
 * preview reports. Renders the same `CardFace` as the destination, so the final
 * cross-fade is between two near-identical views.
 *
 * Never blocks touches, and always tears itself down — a stuck card floating
 * over the whole app would be far worse than a missed animation.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CardFace } from '@/components/vault/CardFace';
import { useCardMorphStore } from '@/stores/cardMorphStore';
import { DEFAULT_CARD_THEME } from '@/lib/cardThemes';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Give up if the destination never measures (navigated elsewhere, unmounted). */
const TARGET_TIMEOUT_MS = 1500;
const TRAVEL_MS = 420;
const FADE_MS = 150;

export function CardMorphOverlay() {
  const card = useCardMorphStore((s) => s.card);
  const from = useCardMorphStore((s) => s.from);
  const to = useCardMorphStore((s) => s.to);
  const phase = useCardMorphStore((s) => s.phase);
  const land = useCardMorphStore((s) => s.land);
  const finish = useCardMorphStore((s) => s.finish);
  const reduced = useReducedMotion();

  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (phase === 'pending') {
      // Start of a hand-off — park at the source rect, fully opaque. This is the
      // only entry point, so it doubles as the reset for a repeat scan.
      progress.value = 0;
      opacity.value = 1;
      // Abandon it if the destination never measures.
      const t = setTimeout(finish, TARGET_TIMEOUT_MS);
      return () => clearTimeout(t);
    }

    if (phase === 'running') {
      if (reduced) {
        progress.value = 1;
        land();
        return;
      }
      progress.value = withTiming(
        1,
        { duration: TRAVEL_MS, easing: Easing.out(Easing.cubic) },
        (done) => {
          if (done) runOnJS(land)();
        },
      );
      return;
    }

    if (phase === 'landing') {
      opacity.value = withTiming(0, { duration: FADE_MS }, (done) => {
        if (done) runOnJS(finish)();
      });
      // Safety net in case the completion callback never lands.
      const t = setTimeout(finish, FADE_MS + 250);
      return () => clearTimeout(t);
    }
  }, [phase, reduced, land, finish, progress, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!from || !to) {
      return { opacity: opacity.value, transform: [] };
    }
    const p = progress.value;
    const scale = to.width > 0 ? from.width / to.width : 1;
    const dx = from.x + from.width / 2 - (to.x + to.width / 2);
    const dy = from.y + from.height / 2 - (to.y + to.height / 2);
    return {
      opacity: opacity.value,
      transform: [
        { translateX: (1 - p) * dx },
        { translateY: (1 - p) * dy },
        { scale: 1 + (1 - p) * (scale - 1) },
      ],
    };
  });

  if (phase === 'idle' || !card || !from) return null;

  // Before the destination measures, hold at the source rect. Once it does, the
  // container moves to the target rect and the transform above puts it back
  // exactly where it was, so the swap is invisible.
  const rect = to ?? from;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.host,
        { left: rect.x, top: rect.y, width: rect.width },
        animatedStyle,
      ]}
    >
      <CardFace
        nickname="Card nickname"
        bankName="Bank"
        network={card.network}
        lastFour={card.lastFour}
        themeId={DEFAULT_CARD_THEME}
        expiryMonth={card.expiryMonth ?? undefined}
        expiryYear={card.expiryYear ?? undefined}
        cardholderName={card.cardholderName}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    // Android needs elevation too — zIndex alone won't lift this above the
    // native screen container the navigator renders into.
    zIndex: 100,
    elevation: 24,
  },
});
