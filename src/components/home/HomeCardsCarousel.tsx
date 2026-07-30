/**
 * HomeCardsCarousel — permanent Home strip of compact metallic cards.
 * Next card peeks from the right; no section header (layout matches reference).
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { HomeCarouselCard } from '@/components/home/HomeCarouselCard';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { VaultCard } from '@/types/card';

/** ~72% viewport so the next card peeks (~18–22% + gap). */
const CARD_WIDTH_RATIO = 0.72;
/** Slightly flatter than ISO ID-1 so Home density matches the reference. */
const CARD_ASPECT = 1.72;
const CARD_GAP = spacing.md;

export function HomeCardsCarousel({
  cards,
  loading,
  delay = 0,
  onSelectCard,
  onAddCard,
}: {
  cards: VaultCard[];
  loading?: boolean;
  delay?: number;
  onSelectCard: (id: string) => void;
  onAddCard: () => void;
}) {
  const palette = usePalette();
  const { width: screenW } = useWindowDimensions();
  const cardWidth = Math.round(screenW * CARD_WIDTH_RATIO);
  const cardHeight = Math.round(cardWidth / CARD_ASPECT);

  if (loading && cards.length === 0) {
    return (
      <View style={[styles.loading, { height: cardHeight }]}>
        <ActivityIndicator color={palette.indigo} />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <GlassCard style={styles.empty} padding={spacing.lg}>
        <AppText variant="body" color={palette.textSecondary}>
          Your cards will show up here once you add one.
        </AppText>
      </GlassCard>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + CARD_GAP}
      snapToAlignment="start"
      style={styles.scroller}
      contentContainerStyle={[
        styles.row,
        {
          // Align first card with Home content padding; peek extends past.
          paddingLeft: spacing.xl,
          paddingRight: spacing.xl,
        },
      ]}
    >
      {cards.map((card, i) => (
        <HomeCarouselCard
          key={card.id}
          card={card}
          width={cardWidth}
          height={cardHeight}
          index={i}
          delay={delay}
          onPress={() => onSelectCard(card.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    marginHorizontal: -spacing.xl,
  },
  row: {
    gap: CARD_GAP,
    paddingVertical: spacing.xs,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    gap: spacing.md,
    borderRadius: radius.lg,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
});
