/**
 * TrackStatementSection — spend analysis entry on Checklist.
 *
 * ADDITION BEYOND THE TRACK REDESIGN REFERENCE IMAGE.
 * The screenshot has no statement UI; this card is intentionally kept between
 * the stat tiles and MILESTONES so PDF upload / spend summary remains reachable.
 *
 * Reuses /card/[id]/statement upload + StatementSummary (not rebuilt).
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText } from '@/components/ui/AppText';
import { IconBadge } from '@/components/ui/IconBadge';
import { StatementSummary } from '@/components/statement/StatementSummary';
import { useLatestStatement } from '@/hooks/useStatementUpload';
import { showDialog } from '@/stores/dialogStore';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { VaultCard } from '@/types/card';

function resolveStatementCardId(
  cards: VaultCard[],
  preferredCardId: string | null,
): string | null {
  if (preferredCardId && cards.some((c) => c.id === preferredCardId)) {
    return preferredCardId;
  }
  if (cards.length === 1) return cards[0]!.id;
  return null;
}

function pickCardThen(
  cards: VaultCard[],
  onPick: (cardId: string) => void,
) {
  if (cards.length === 0) {
    showDialog({
      title: 'Add a card first',
      message: 'Upload a statement after you add a card to your vault.',
      icon: 'card-outline',
      tone: 'amber',
    });
    return;
  }
  if (cards.length === 1) {
    onPick(cards[0]!.id);
    return;
  }
  showDialog({
    title: 'Upload a statement',
    message: 'Which card is this statement for?',
    icon: 'document-text-outline',
    tone: 'indigo',
    actions: [
      ...cards.slice(0, 8).map((c) => ({
        label: c.nickname.length > 36 ? `${c.nickname.slice(0, 35)}…` : c.nickname,
        onPress: () => onPick(c.id),
      })),
      { label: 'Cancel', variant: 'ghost' as const },
    ],
  });
}

function UploadCta({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <GlassCard style={styles.cta} padding={spacing.lg} elevation="raised">
        <IconBadge icon="document-text-outline" tone="indigo" size={36} />
        <View style={styles.ctaText}>
          <AppText variant="body" style={styles.ctaTitle}>
            {title}
          </AppText>
          <AppText variant="caption" color={palette.textSecondary}>
            {subtitle}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
      </GlassCard>
    </Pressable>
  );
}

function StatementLoaded({ cardId }: { cardId: string }) {
  const palette = usePalette();
  const router = useRouter();
  const { data: latest, isLoading } = useLatestStatement(cardId);
  const goStatement = () => router.push(`/card/${cardId}/statement` as Href);

  if (isLoading) {
    return (
      <GlassCard padding={spacing.lg} elevation="flat">
        <AppText variant="small" color={palette.textTertiary}>
          Loading statement…
        </AppText>
      </GlassCard>
    );
  }

  if (!latest) {
    return (
      <UploadCta
        title="Upload a statement"
        subtitle="PDF spend breakdown — categories, rewards, and dues"
        onPress={goStatement}
      />
    );
  }

  const spendChangePct =
    latest.priorPeriodSpend && latest.priorPeriodSpend > 0
      ? ((latest.totalSpend - latest.priorPeriodSpend) / latest.priorPeriodSpend) *
        100
      : null;

  return (
    <View style={styles.loaded}>
      <StatementSummary data={latest} spendChangePct={spendChangePct} />
      <Pressable
        onPress={goStatement}
        accessibilityRole="button"
        accessibilityLabel="Upload a newer statement PDF"
      >
        <GlassCard style={styles.update} padding={spacing.md} elevation="flat">
          <Ionicons name="refresh-outline" size={18} color={palette.indigo} />
          <AppText
            variant="small"
            color={palette.textSecondary}
            style={styles.updateText}
          >
            Upload a newer statement PDF
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
        </GlassCard>
      </Pressable>
    </View>
  );
}

export function TrackStatementSection({
  cards,
  preferredCardId = null,
}: {
  cards: VaultCard[];
  preferredCardId?: string | null;
}) {
  const router = useRouter();
  const cardId = resolveStatementCardId(cards, preferredCardId);

  if (cards.length === 0) return null;

  if (!cardId) {
    return (
      <UploadCta
        title="Upload a statement"
        subtitle="PDF spend breakdown by card — pick which card first"
        onPress={() =>
          pickCardThen(cards, (id) =>
            router.push(`/card/${id}/statement` as Href),
          )
        }
      />
    );
  }

  return <StatementLoaded cardId={cardId} />;
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaText: { flex: 1, minWidth: 0, gap: 2 },
  ctaTitle: { fontWeight: '600' },
  loaded: { gap: spacing.sm },
  update: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  updateText: { flex: 1, minWidth: 0 },
});
