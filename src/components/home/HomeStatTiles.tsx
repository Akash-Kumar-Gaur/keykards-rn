/**
 * HomeStatTiles — plain 2-up glance tiles (label above, bold figure below).
 * No icon badges — matches the reference’s simpler treatment.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/AppText';
import { CountUpText } from '@/components/ui/CountUpText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

function Tile({
  label,
  value,
  delay = 0,
}: {
  label: string;
  value: string;
  delay?: number;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = reduced
      ? 1
      : withDelay(
          delay,
          withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 10 }],
  }));

  return (
    <Animated.View style={[styles.tileWrap, style]}>
      <GlassCard style={styles.tile} padding={spacing.lg} elevation="flat">
        <Eyebrow color={palette.textTertiary}>{label}</Eyebrow>
        <CountUpText
          value={value}
          delay={delay + 80}
          variant="h2"
          style={styles.value}
        />
      </GlassCard>
    </Animated.View>
  );
}

export function HomeStatTiles({
  cardCount,
  annualFeesLabel,
  delay = 0,
}: {
  cardCount: number;
  annualFeesLabel: string;
  delay?: number;
}) {
  return (
    <View style={styles.row}>
      <Tile label="Cards in Vault" value={String(cardCount)} delay={delay} />
      <Tile label="Annual Fees" value={annualFeesLabel} delay={delay + 60} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tileWrap: { flex: 1 },
  tile: {
    gap: spacing.sm,
    minHeight: 96,
    borderRadius: radius.lg,
    justifyContent: 'space-between',
  },
  value: { marginTop: 0 },
});
