/**
 * SmartSwipeCard — category chips + recommended card fact row.
 * Catalog facts only — no ₹ earn estimates.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { spacing, radius } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getCardTheme } from '@/lib/cardThemes';
import type { CatalogSmartSwipeResult } from '@/lib/catalogSmartSwipe';
import type { BenefitCategory, CardColorTheme } from '@/types/card';
import { BENEFIT_CATEGORY_META } from '@/components/card/benefitCategoryMeta';

interface SmartSwipeCardProps {
  recommendation: CatalogSmartSwipeResult | null;
  category: BenefitCategory;
  categories: BenefitCategory[];
  onSelectCategory: (c: BenefitCategory) => void;
  onOpenCard?: () => void;
  onAddCard?: () => void;
  delay?: number;
  hasCards: boolean;
  cardCount: number;
  /** Theme for the recommended card’s color swatch. */
  themeId?: CardColorTheme | null;
}

export function SmartSwipeCard({
  recommendation,
  category,
  categories,
  onSelectCategory,
  onOpenCard,
  onAddCard,
  delay = 0,
  hasCards,
  cardCount,
  themeId,
}: SmartSwipeCardProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const resultProgress = useSharedValue(1);
  const [display, setDisplay] = useState(recommendation);
  const pendingRef = useRef(recommendation);
  const prevKey = useRef<string | null>(null);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, delay]);

  const commitResult = () => {
    setDisplay(pendingRef.current);
    resultProgress.value = withTiming(1, {
      duration: reduced ? 0 : 220,
      easing: Easing.out(Easing.cubic),
    });
  };

  useEffect(() => {
    const key = recommendation
      ? `${recommendation.cardId}:${recommendation.categoryKey}:${recommendation.rewardValue}`
      : `empty:${category}`;
    pendingRef.current = recommendation;

    if (prevKey.current === null) {
      prevKey.current = key;
      setDisplay(recommendation);
      return;
    }
    if (prevKey.current === key) return;
    prevKey.current = key;

    if (reduced) {
      setDisplay(recommendation);
      resultProgress.value = 1;
      return;
    }

    resultProgress.value = withTiming(
      0,
      { duration: 140, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(commitResult)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation, category, reduced]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.96 + progress.value * 0.04 }],
  }));

  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultProgress.value,
    transform: [{ translateY: (1 - resultProgress.value) * 8 }],
  }));

  const needMoreCards = cardCount < 2;
  const empty = !display;
  const swatchColors = getCardTheme(themeId ?? 'generic-slate').colors;

  return (
    <Animated.View style={cardStyle}>
      <GlassCard strong padding={spacing.xl} style={styles.card} elevation="raised">
        <View style={styles.headerRow}>
          <AppText variant="title">Smart Swipe</AppText>
          {!empty ? (
            <Eyebrow color={palette.indigo} style={styles.badge}>
              Best card found
            </Eyebrow>
          ) : null}
        </View>

        <View style={styles.chips}>
          {categories.map((c) => {
            const selected = c === category;
            const meta = BENEFIT_CATEGORY_META[c];
            return (
              <Pressable
                key={c}
                onPress={() => onSelectCategory(c)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? palette.indigo : palette.glassBorder,
                    backgroundColor: selected ? palette.indigo : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={meta.label}
              >
                <AppText
                  variant="caption"
                  color={selected ? palette.textOnAccent : palette.textSecondary}
                >
                  {meta.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Animated.View style={[styles.result, resultStyle]}>
          {empty ? (
            <View style={styles.emptyBody}>
              <AppText variant="body" color={palette.textSecondary}>
                {needMoreCards
                  ? hasCards
                    ? 'Add one more card to compare which one fits each category.'
                    : 'Add your cards to see which one to swipe for dining, fuel, and more.'
                  : `No ${BENEFIT_CATEGORY_META[category].label.toLowerCase()} benefit listed on your cards yet.`}
              </AppText>
              {needMoreCards && hasCards && onAddCard ? (
                <PillButton
                  label="Add a card"
                  variant="primary"
                  size="md"
                  onPress={onAddCard}
                />
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={onOpenCard}
              style={styles.resultRow}
              accessibilityRole="button"
              accessibilityLabel={`Open ${display.cardName}`}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: swatchColors[0],
                    borderColor: 'rgba(255,255,255,0.12)',
                  },
                ]}
              />
              <View style={styles.resultText}>
                <AppText variant="title" numberOfLines={1}>
                  {display.cardName}
                </AppText>
                {display.rewardValue ? (
                  <AppText
                    variant="small"
                    color={palette.textSecondary}
                    numberOfLines={2}
                  >
                    {display.rewardValue}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          )}
        </Animated.View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  badge: { flexShrink: 0 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill ?? 999,
    borderWidth: 1,
  },
  result: {
    marginTop: spacing.xl,
    minHeight: 52,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  emptyBody: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
});
