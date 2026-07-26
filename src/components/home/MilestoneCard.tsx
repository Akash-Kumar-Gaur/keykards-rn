/**
 * MilestoneCard — spend-milestone panel (Home section anchor).
 * Optional footer action (e.g. Open Track) lives inside this section.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PillButton } from '@/components/ui/PillButton';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { MilestoneData } from '@/types/dashboard';

export function MilestoneCard({
  data,
  footerLabel,
  onFooterPress,
}: {
  data: MilestoneData | null;
  footerLabel?: string;
  onFooterPress?: () => void;
}) {
  const palette = usePalette();

  return (
    <GlassCard
      padding={spacing.xl}
      elevation="emphasis"
      style={styles.card}
    >
      <Eyebrow color={palette.indigo}>Milestone</Eyebrow>
      {!data ? (
        <>
          <View style={styles.emptyRow}>
            <View
              style={[styles.emptyIcon, { backgroundColor: palette.indigoSoft }]}
            >
              <Ionicons name="flag-outline" size={18} color={palette.indigo} />
            </View>
            <View style={styles.emptyText}>
              <AppText variant="title">Spend milestone</AppText>
              <AppText variant="small" color={palette.textTertiary}>
                Add a card to start tracking spend milestones
              </AppText>
            </View>
          </View>
          <View style={styles.bar}>
            <ProgressBar progress={0} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.headerRow}>
            <AppText
              variant="title"
              style={styles.title}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {data.title}
            </AppText>
            <AppText variant="body" color={palette.indigo} style={styles.amount}>
              {data.current} / {data.target}
            </AppText>
          </View>
          <View style={styles.bar}>
            <ProgressBar progress={data.progress} />
          </View>
          <AppText
            variant="small"
            color={palette.textTertiary}
            style={styles.helper}
            numberOfLines={3}
            ellipsizeMode="tail"
          >
            {data.helperText}
          </AppText>
        </>
      )}
      {footerLabel && onFooterPress ? (
        <View style={styles.footer}>
          <PillButton
            label={footerLabel}
            size="sm"
            variant="ghost"
            icon="analytics-outline"
            onPress={onFooterPress}
          />
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  amount: {
    flexShrink: 0,
    textAlign: 'right',
    maxWidth: '42%',
  },
  bar: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  helper: {
    flexShrink: 1,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { flex: 1, gap: 2 },
  footer: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
});
