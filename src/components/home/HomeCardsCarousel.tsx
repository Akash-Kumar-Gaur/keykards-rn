/**
 * HomeCardsCarousel — horizontal quick-access row of Vault Tier-2 compact cards.
 * Shown on Home when Smart Swipe is not eligible (low card/txn signal).
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
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { VaultCompactCard } from '@/components/vault/VaultCompactCard';
import { vaultCardHeight, vaultStagger } from '@/lib/vaultDensity';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { VaultCard } from '@/types/card';

const CARD_WIDTH_RATIO = 0.72;
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
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);
  const cardHeight = vaultCardHeight('compact', cardWidth);

  return (
    <AnimatedEntrance delay={delay} offsetY={18} style={styles.wrap}>
      <View style={styles.header}>
        <Eyebrow color={palette.indigo}>Vault</Eyebrow>
        <AppText variant="title">Your cards</AppText>
        <AppText variant="caption" color={palette.textTertiary}>
          Tap a card to open details
        </AppText>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.indigo} />
        </View>
      ) : cards.length === 0 ? (
        <GlassCard style={styles.empty} padding={spacing.lg}>
          <AppText variant="body" color={palette.textSecondary}>
            Add your first card to see it here for quick access.
          </AppText>
          <Pressable
            onPress={onAddCard}
            style={styles.emptyCta}
            accessibilityRole="button"
            accessibilityLabel="Add your first card"
          >
            <Ionicons name="add-circle-outline" size={20} color={palette.indigo} />
            <AppText variant="small" color={palette.indigo}>
              Add your first card
            </AppText>
          </Pressable>
        </GlassCard>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + CARD_GAP}
          snapToAlignment="start"
          // Bleed to screen edges while Home content stays padded.
          style={styles.scroller}
          contentContainerStyle={[
            styles.row,
            { paddingHorizontal: spacing.xl },
          ]}
        >
          {cards.map((card, i) => (
            <AnimatedEntrance
              key={card.id}
              delay={vaultStagger('compact', i)}
              offsetY={14}
              style={{ width: cardWidth }}
            >
              <VaultCompactCard
                card={card}
                height={cardHeight}
                onPress={() => onSelectCard(card.id)}
              />
            </AnimatedEntrance>
          ))}
        </ScrollView>
      )}
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: spacing.sm },
  header: { gap: 2, paddingHorizontal: 2 },
  row: {
    gap: CARD_GAP,
    paddingVertical: spacing.xs,
  },
  scroller: {
    marginHorizontal: -spacing.xl,
  },
  loading: {
    minHeight: 88,
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
