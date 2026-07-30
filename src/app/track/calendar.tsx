/**
 * Renewal & fee calendar — dates from cards, not transaction detection.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tag } from '@/components/ui/Tag';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { useAuthStore } from '@/stores/authStore';
import { useRenewalCalendar } from '@/hooks/useCatalogFirst';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function RenewalCalendarScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { events, isLoading } = useRenewalCalendar(userId);

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
        <Eyebrow color={palette.indigo}>From your cards</Eyebrow>
        <AppText variant="h1">Renewal calendar</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          Fee due dates and renewals you entered or estimated — not detected from
          bank alerts.
        </AppText>

        {isLoading ? (
          <AppText variant="small" color={palette.textTertiary}>
            Loading…
          </AppText>
        ) : null}

        {events.length === 0 ? (
          <GlassCard padding={spacing.xl}>
            <AppText variant="body">No renewal or fee dates yet</AppText>
            <AppText variant="small" color={palette.textSecondary}>
              Add a fee due date or renewal date on a card to see it here.
            </AppText>
          </GlassCard>
        ) : (
          events.map((ev) => (
            <Pressable
              key={`${ev.cardId}-${ev.kind}-${ev.date}`}
              onPress={() => router.push(`/card/${ev.cardId}` as Href)}
            >
              <GlassCard style={styles.row} padding={spacing.lg}>
                <View style={styles.rowTop}>
                  <Tag label={ev.kind === 'fee' ? 'Fee due' : 'Renewal'} />
                  {!ev.confirmed ? (
                    <ConfidenceBadge kind="estimated" />
                  ) : (
                    <ConfidenceBadge kind="confirmed" />
                  )}
                </View>
                <AppText variant="title">{formatDate(ev.date)}</AppText>
                <AppText
                  variant="small"
                  color={palette.textSecondary}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {ev.cardNickname}
                </AppText>
              </GlassCard>
            </Pressable>
          ))
        )}
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
  row: { gap: spacing.sm },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
