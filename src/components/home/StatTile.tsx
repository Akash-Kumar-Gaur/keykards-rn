/**
 * StatTile — compact glance tile. Empty values use a muted icon + label,
 * never a bare em-dash.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { IconBadge, BadgeTone } from '@/components/ui/IconBadge';
import { CountUpText } from '@/components/ui/CountUpText';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { StatTileData } from '@/types/dashboard';

interface StatTileProps {
  data: StatTileData;
  icon: keyof typeof Ionicons.glyphMap;
  tone: BadgeTone;
  subLabelColor?: string;
  delay?: number;
}

function isEmptyValue(value: string): boolean {
  const t = value.trim();
  return !t || t === '—' || t === '-' || t === '–';
}

export function StatTile({
  data,
  icon,
  tone,
  subLabelColor,
  delay = 0,
}: StatTileProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const badge = useSharedValue(0);
  const empty = isEmptyValue(data.value);
  const toneText = useMemo(
    () => ({
      amber: palette.amber,
      green: palette.green,
      indigo: palette.indigo,
    }),
    [palette],
  );

  useEffect(() => {
    if (reduced) {
      badge.value = 1;
      return;
    }
    badge.value = withDelay(
      delay + 180,
      withSpring(1, motion.springConfig),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, delay]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badge.value,
    transform: [{ scale: badge.value }],
  }));

  const entrance = useSharedValue(0);
  useEffect(() => {
    entrance.value = reduced
      ? 1
      : withDelay(delay, withTiming(1, { duration: 420 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, delay]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 10 }],
  }));

  return (
    <Animated.View style={[styles.wrap, cardStyle]}>
      <GlassCard
        style={styles.tile}
        padding={spacing.md}
        elevation="flat"
      >
        <View style={styles.top}>
          <Animated.View style={badgeStyle}>
            <IconBadge icon={icon} tone={tone} size={32} />
          </Animated.View>
          <Eyebrow color={palette.textTertiary} style={styles.label}>
            {data.label}
          </Eyebrow>
        </View>
        {empty ? (
          <View style={styles.emptyBlock}>
            <Ionicons
              name={icon}
              size={16}
              color={palette.textTertiary}
              style={styles.emptyIcon}
            />
            <AppText
              variant="small"
              color={palette.textTertiary}
              numberOfLines={2}
            >
              {data.subLabel}
            </AppText>
          </View>
        ) : (
          <View style={styles.text}>
            <CountUpText
              value={data.value}
              delay={delay + 80}
              variant="title"
              style={styles.value}
            />
            <AppText
              variant="caption"
              color={subLabelColor ?? toneText[tone]}
              numberOfLines={2}
            >
              {data.subLabel}
            </AppText>
          </View>
        )}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  tile: {
    flex: 1,
    gap: spacing.sm,
    minHeight: 108,
    borderRadius: radius.lg,
    justifyContent: 'space-between',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { flex: 1, flexShrink: 1 },
  text: { gap: 2 },
  value: { marginTop: 0 },
  emptyBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  emptyIcon: { marginTop: 1, opacity: 0.7 },
});
