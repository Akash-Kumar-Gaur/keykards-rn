/**
 * TIER 1 — SPOTLIGHT (1-3 cards).
 * Full-weight card face (chip, contactless, embossed masked number, bank,
 * network mark) with a per-card ambient glow tinted to its theme, a glass
 * top-edge highlight, and a one-shot gloss sweep after the entrance settles.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { CardFace } from '@/components/vault/CardFace';
import { CardThemeGlow } from '@/components/vault/CardThemeGlow';
import { OneShotShimmer } from '@/components/ui/OneShotShimmer';
import { getCardTheme } from '@/lib/cardThemes';
import { radius, motion } from '@/theme';
import { useCardCanvasElevation } from '@/hooks/useCardCanvasElevation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VaultCard } from '@/types/card';

export function VaultSpotlightCard({
  card,
  onPress,
  shineDelay = 700,
}: {
  card: VaultCard;
  onPress: () => void;
  shineDelay?: number;
}) {
  const reduced = useReducedMotion();
  const canvasElevation = useCardCanvasElevation();
  const press = useSharedValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const faceColor = getCardTheme(card.cardColorTheme).colors[0];

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ width, height });
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.03 }],
  }));

  const setPressed = (value: number) => {
    if (reduced) {
      press.value = value;
      return;
    }
    press.value = withSpring(value, motion.springConfig);
  };

  return (
    <View style={styles.wrap}>
      {size.width > 0 ? (
        <CardThemeGlow
          themeId={card.cardColorTheme}
          width={size.width}
          height={size.height}
          intensity={press}
        />
      ) : null}

      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(1)}
        onPressOut={() => setPressed(0)}
        accessibilityRole="button"
        accessibilityLabel={`${card.nickname}, ${card.bankName}, ending ${card.lastFour}`}
      >
        <Animated.View
          style={[
            styles.elevated,
            { backgroundColor: faceColor },
            cardStyle,
            canvasElevation,
          ]}
          onLayout={onLayout}
        >
          <View style={styles.clip}>
            <CardFace
              nickname={card.nickname}
              bankName={card.bankName}
              network={card.network}
              lastFour={card.lastFour}
              themeId={card.cardColorTheme}
              expiryMonth={card.expiryMonth}
              expiryYear={card.expiryYear}
              cardholderName={card.cardholderName}
              elevate={false}
            />
            <OneShotShimmer delay={shineDelay} />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  elevated: {
    borderRadius: radius.xl,
  },
  clip: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
});
