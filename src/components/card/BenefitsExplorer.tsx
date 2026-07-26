/**
 * BenefitsExplorer — the benefits section as an explorable experience:
 *   • animated category filter chips (reusing AnimatedFilterChips)
 *   • a horizontally-scrollable carousel of teaser cards
 *   • tap a card → bottom sheet with the full description + value estimate
 *
 * Teaser cards stagger in (scale+fade) when the section scrolls into view
 * (driven by the `play` prop) and press-scale on tap. Detail uses a bottom
 * sheet — see note in the screen: inline expand-in-place fights the horizontal
 * carousel's layout, whereas a sheet gives room for the full copy and matches
 * the overflow-menu sheet pattern introduced on this screen.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconBadge } from '@/components/ui/IconBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  AnimatedFilterChips,
  type FilterChipOption,
} from '@/components/vault/AnimatedFilterChips';
import { categoryMeta, teaserLine } from './benefitCategoryMeta';
import { formatInr } from '@/lib/cardUtils';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { BENEFIT_CATEGORIES, type CardBenefit } from '@/types/card';

const CARD_W = 220;

export function BenefitsExplorer({
  benefits,
  play,
  onManage,
}: {
  benefits: CardBenefit[];
  play: boolean;
  onManage?: () => void;
}) {
  const palette = usePalette();
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState<CardBenefit | null>(null);
  const [maxCardHeight, setMaxCardHeight] = useState(0);

  const presentCategories = useMemo(() => {
    const set = new Set(benefits.map((b) => b.category));
    return BENEFIT_CATEGORIES.filter((c) => set.has(c));
  }, [benefits]);

  const filterOptions: FilterChipOption[] = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...presentCategories.map((c) => ({
        id: c,
        label: categoryMeta(c).label,
      })),
    ],
    [presentCategories],
  );

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? benefits
        : benefits.filter((b) => b.category === filter),
    [benefits, filter],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Eyebrow color={palette.indigo}>Benefits</Eyebrow>
          <AppText variant="title">Worth exploring</AppText>
        </View>
        {onManage ? (
          <Pressable onPress={onManage} hitSlop={8} accessibilityRole="button">
            <AppText variant="small" color={palette.indigo}>
              Manage
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {benefits.length === 0 ? (
        <GlassCard style={styles.empty} padding={spacing.xl}>
          <IconBadge icon="gift-outline" tone="indigo" size={40} />
          <AppText variant="body" color={palette.textSecondary} style={styles.emptyText}>
            No benefits yet. Add a few to track what this card is really worth.
          </AppText>
          {onManage ? (
            <Pressable onPress={onManage} hitSlop={8}>
              <AppText variant="small" color={palette.indigo}>
                Add benefits
              </AppText>
            </Pressable>
          ) : null}
        </GlassCard>
      ) : (
        <>
          {presentCategories.length > 1 ? (
            <View style={styles.filters}>
              <AnimatedFilterChips
                options={filterOptions}
                value={filter}
                onChange={setFilter}
              />
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            decelerationRate="fast"
            snapToInterval={CARD_W + spacing.md}
            snapToAlignment="start"
          >
            {filtered.map((benefit, i) => (
              <BenefitTeaserCard
                key={benefit.id}
                benefit={benefit}
                index={i}
                play={play}
                height={maxCardHeight || undefined}
                onMeasureHeight={(height) => {
                  setMaxCardHeight((current) => Math.max(current, height));
                }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActive(benefit);
                }}
              />
            ))}
          </ScrollView>
        </>
      )}

      <BenefitDetailSheet
        benefit={active}
        onClose={() => setActive(null)}
      />
    </View>
  );
}

function BenefitTeaserCard({
  benefit,
  index,
  play,
  height,
  onMeasureHeight,
  onPress,
}: {
  benefit: CardBenefit;
  index: number;
  play: boolean;
  height?: number;
  onMeasureHeight: (height: number) => void;
  onPress: () => void;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const meta = categoryMeta(benefit.category);
  const enter = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    if (!play) return;
    enter.value = reduced
      ? 1
      : withDelay(index * 70, withSpring(1, motion.springConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: (0.92 + enter.value * 0.08) * press.value },
      { translateY: (1 - enter.value) * 16 },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          press.value = withTiming(0.97, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withSpring(1, motion.springConfig);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${benefit.title}. Tap for details.`}
      >
        <GlassCard
          style={[styles.teaser, height ? { height } : undefined]}
          padding={spacing.lg}
        >
          <View
            style={styles.teaserContent}
            onLayout={(event) => {
              onMeasureHeight(event.nativeEvent.layout.height + spacing.lg * 2);
            }}
          >
          <View style={styles.teaserTop}>
            <IconBadge icon={meta.icon} tone={meta.tone} size={38} />
            {benefit.valueEstimate != null ? (
              <View style={[styles.valuePill, { backgroundColor: palette.greenSoft }]}>
                <AppText variant="caption" color={palette.green}>
                  ~{formatInr(benefit.valueEstimate)}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="bodyLg" numberOfLines={2} style={styles.teaserTitle}>
            {benefit.title}
          </AppText>
          <AppText
            variant="small"
            color={palette.textSecondary}
            numberOfLines={2}
            style={styles.teaserBody}
          >
            {teaserLine(benefit.description)}
          </AppText>
          <View style={styles.teaserFooter}>
            <AppText variant="caption" color={palette.indigo}>
              {meta.label}
            </AppText>
            <Ionicons name="arrow-forward" size={14} color={palette.indigo} />
          </View>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

function BenefitDetailSheet({
  benefit,
  onClose,
}: {
  benefit: CardBenefit | null;
  onClose: () => void;
}) {
  const palette = usePalette();
  // Keep last non-null benefit while the sheet animates out.
  const [shown, setShown] = useState<CardBenefit | null>(benefit);
  useEffect(() => {
    if (benefit) setShown(benefit);
  }, [benefit]);

  const meta = shown ? categoryMeta(shown.category) : null;

  return (
    <BottomSheet visible={Boolean(benefit)} onClose={onClose}>
      {shown && meta ? (
        <View style={styles.detail}>
          <View style={styles.detailHead}>
            <IconBadge icon={meta.icon} tone={meta.tone} size={48} />
            <View style={styles.detailHeadText}>
              <Eyebrow color={palette.indigo}>{meta.label}</Eyebrow>
              <AppText variant="h2">{shown.title}</AppText>
            </View>
          </View>

          {shown.valueEstimate != null ? (
            <View
              style={[
                styles.detailValue,
                {
                  backgroundColor: palette.glassFill,
                  borderColor: palette.glassBorder,
                },
              ]}
            >
              <AppText variant="small" color={palette.textSecondary}>
                Estimated annual value
              </AppText>
              <AppText variant="stat" color={palette.green}>
                {formatInr(shown.valueEstimate)}
              </AppText>
            </View>
          ) : null}

          <AppText variant="body" color={palette.textSecondary} style={styles.detailBody}>
            {shown.description?.trim() || 'No description added for this benefit yet.'}
          </AppText>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  headerText: { gap: 2 },
  filters: { marginHorizontal: -spacing.xl },
  carousel: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  teaser: {
    width: CARD_W,
    minHeight: 168,
  },
  teaserContent: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  teaserTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valuePill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  teaserTitle: { marginTop: spacing.xs },
  teaserBody: { flex: 1 },
  teaserFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  empty: {
    marginHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: { textAlign: 'center' },
  detail: { gap: spacing.lg, paddingBottom: spacing.sm },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailHeadText: { flex: 1, gap: 2 },
  detailValue: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  detailBody: { lineHeight: 22 },
});
