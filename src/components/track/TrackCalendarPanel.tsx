/**
 * TrackCalendarPanel — renewal & fee dates from cards (confirmed vs estimated).
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText } from '@/components/ui/AppText';
import { Tag } from '@/components/ui/Tag';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { useAuthStore } from '@/stores/authStore';
import { useRenewalCalendar } from '@/hooks/useCatalogFirst';
import { spacing, motion } from '@/theme';
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

export function TrackCalendarPanel({ delayBase = 0 }: { delayBase?: number }) {
  const palette = usePalette();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { events, isLoading } = useRenewalCalendar(userId);

  return (
    <View style={styles.wrap}>
      <AnimatedEntrance delay={delayBase}>
        <AppText variant="small" color={palette.textSecondary}>
          Fee due dates and renewals from your cards — confirmed when you entered
          them, estimated when derived from policy.
        </AppText>
      </AnimatedEntrance>

      {isLoading ? (
        <AppText variant="small" color={palette.textTertiary}>
          Loading…
        </AppText>
      ) : null}

      {events.length === 0 && !isLoading ? (
        <AnimatedEntrance delay={delayBase + 40}>
          <GlassCard padding={spacing.xl}>
            <AppText variant="body">No renewal or fee dates yet</AppText>
            <AppText variant="small" color={palette.textSecondary}>
              Add a fee due date or renewal date on a card to see it here.
            </AppText>
          </GlassCard>
        </AnimatedEntrance>
      ) : null}

      {events.map((ev, i) => (
        <AnimatedEntrance
          key={`${ev.cardId}-${ev.kind}-${ev.date}`}
          delay={delayBase + motion.staggerStep + i * 55}
          offsetY={12}
        >
          <Pressable onPress={() => router.push(`/card/${ev.cardId}` as Href)}>
            <GlassCard style={styles.row} padding={spacing.lg} elevation="flat">
              <View style={styles.rowTop}>
                <Tag label={ev.kind === 'fee' ? 'Fee due' : 'Renewal'} />
                <ConfidenceBadge kind={ev.confirmed ? 'confirmed' : 'estimated'} />
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
        </AnimatedEntrance>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { gap: spacing.sm },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
