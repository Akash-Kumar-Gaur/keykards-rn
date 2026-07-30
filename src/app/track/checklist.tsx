/**
 * Benefits checklist — manual period ticks against catalog benefits.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/authStore';
import { useBenefitChecklist } from '@/hooks/useCatalogFirst';
import { formatPeriodLabel } from '@/lib/benefitPeriod';
import { categoryMeta } from '@/components/card/benefitCategoryMeta';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function BenefitsChecklistScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { periodKey, cards, checkedIds, isLoading, toggle } =
    useBenefitChecklist(userId);

  return (
    <View style={styles.root}>
      <GlowBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.huge,
          },
        ]}
      >
        <PillButton
          label="Back"
          variant="ghost"
          size="sm"
          icon="chevron-back"
          onPress={() => router.back()}
        />
        <Eyebrow color={palette.indigo}>Manual · always available</Eyebrow>
        <AppText variant="h1">Benefits checklist</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          Tick benefits you used this period ({formatPeriodLabel(periodKey)}).
          Resets each quarter — no parsing required.
        </AppText>

        {isLoading ? (
          <AppText variant="small" color={palette.textTertiary}>
            Loading…
          </AppText>
        ) : null}

        {cards.length === 0 ? (
          <GlassCard padding={spacing.xl}>
            <AppText variant="body">Add a card to see its benefits here.</AppText>
          </GlassCard>
        ) : null}

        {cards.map(({ card, benefits }) => (
          <GlassCard key={card.id} style={styles.card} padding={spacing.lg}>
            <AppText variant="title">{card.nickname}</AppText>
            {benefits.length === 0 ? (
              <AppText variant="small" color={palette.textTertiary}>
                No benefits listed
              </AppText>
            ) : (
              benefits.map((b) => {
                const checked = checkedIds.has(b.id);
                const meta = categoryMeta(b.category);
                return (
                  <Pressable
                    key={b.id}
                    onPress={() =>
                      toggle.mutate({
                        benefitId: b.id,
                        cardId: card.id,
                        checked: !checked,
                      })
                    }
                    style={styles.row}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? palette.green : palette.textTertiary}
                    />
                    <View style={styles.rowText}>
                      <AppText variant="body">{b.title}</AppText>
                      <AppText variant="caption" color={palette.textTertiary}>
                        {meta.label}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })
            )}
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  card: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
});
