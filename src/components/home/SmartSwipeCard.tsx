/**
 * SmartSwipeCard — recommendation panel for authenticated Home only.
 *
 * Props-driven: pass a real recommendation, or leave it null to render the
 * empty state ("Add a card to get recommendations"). Never invents a card name.
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
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { Tag } from '@/components/ui/Tag';
import { Toggle } from '@/components/ui/Toggle';
import { OneShotShimmer } from '@/components/ui/OneShotShimmer';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SmartSwipeRecommendation } from '@/types/dashboard';

interface SmartSwipeCardProps {
  recommendation: SmartSwipeRecommendation | null;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  onGetStarted: () => void;
  onAddCard?: () => void;
  delay?: number;
  hasCards: boolean;
}

export function SmartSwipeCard({
  recommendation,
  enabled,
  onToggle,
  onGetStarted,
  onAddCard,
  delay = 0,
  hasCards,
}: SmartSwipeCardProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.95 + progress.value * 0.05 }],
  }));

  const empty = !recommendation;

  return (
    <Animated.View style={animatedStyle}>
      <GlassCard strong padding={spacing.xl} style={styles.card} elevation="raised">
        <OneShotShimmer delay={delay + 400} />
        <View style={styles.headerRow}>
          <Tag label="Smart Swipe" />
          <Toggle value={enabled} onChange={onToggle} disabled={empty} />
        </View>

        {empty ? (
          <View style={styles.body}>
            <AppText variant="body" color={palette.textSecondary}>
              {hasCards
                ? 'Recommendations unlock once Optimize has enough spend history.'
                : 'Add a card to get recommendations'}
            </AppText>
            <AppText variant="h2" style={styles.cardName}>
              {hasCards ? 'No recommendation yet' : 'Nothing to recommend'}
            </AppText>
            <View style={styles.emptyCta}>
              <PillButton
                label={hasCards ? 'Check back soon' : 'Add a card'}
                variant="primary"
                size="md"
                onPress={hasCards ? onGetStarted : onAddCard ?? onGetStarted}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.body}>
              <AppText variant="body" color={palette.textSecondary}>
                Next best card for {recommendation.category}
              </AppText>
              <AppText variant="h2" style={styles.cardName}>
                {recommendation.cardName}
              </AppText>
            </View>

            <View style={[styles.divider, { backgroundColor: palette.glassBorderStrong }]} />

            <View style={styles.footerRow}>
              <View style={styles.earnBlock}>
                <Eyebrow color={palette.textTertiary}>{recommendation.rewardLabel}</Eyebrow>
                <AppText variant="title" color={palette.indigo} style={styles.earnValue}>
                  {recommendation.rewardValue}
                </AppText>
              </View>
              <PillButton
                label="Get started"
                variant="primary"
                size="md"
                onPress={onGetStarted}
              />
            </View>
          </>
        )}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  cardName: {
    marginTop: 2,
  },
  emptyCta: {
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    marginVertical: spacing.xl,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earnBlock: {
    gap: spacing.xs,
  },
  earnValue: {
    marginTop: 2,
  },
});
