/**
 * Internal dev tools — gated by EXPO_PUBLIC_ADMIN_EMAILS (same gate as
 * catalog review). Destructive data resets for testing only.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconBadge } from '@/components/ui/IconBadge';
import { useAuthStore } from '@/stores/authStore';
import { confirmDialog, showDialog } from '@/stores/dialogStore';
import { isAdminEmail } from '@/lib/admin';
import { logger } from '@/lib/logger';
import { devClearActivityData, type DevResetCounts } from '@/lib/devDataReset';
import { palette, spacing } from '@/theme';

function summarise(counts: DevResetCounts): string {
  return [
    `Transactions deleted: ${counts.transactionsDeleted}`,
    `Points ledger rows deleted: ${counts.pointsLedgerDeleted}`,
    `Milestone rows deleted: ${counts.milestonesDeleted}`,
    `Archived cycles deleted: ${counts.archivedCyclesDeleted}`,
    `Gmail links removed: ${counts.gmailConnectionsDeleted}`,
    `Cards with dates cleared: ${counts.cardDatesCleared}`,
    `Clipboard hash cleared: ${counts.clipboardHashCleared ? 'yes' : 'no'}`,
  ].join('\n');
}

export default function DevToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const admin = isAdminEmail(user?.email);
  const [busy, setBusy] = useState<'txns' | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const invalidateEverything = () => {
    qc.invalidateQueries({ queryKey: ['track'], refetchType: 'all' });
    qc.invalidateQueries({ queryKey: ['cards'], refetchType: 'all' });
    qc.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' });
  };

  if (!admin) {
    return (
      <View style={styles.root}>
        <GlowBackground />
        <View style={[styles.denied, { paddingTop: insets.top + spacing.xxl }]}>
          <AppText variant="h2">Restricted</AppText>
          <AppText variant="body" color={palette.textSecondary} style={styles.center}>
            Dev tools are limited to admin accounts.
          </AppText>
          <PillButton label="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const onClearActivity = async () => {
    if (!user?.id) return;
    const ok = await confirmDialog({
      title: 'Clear all activity data?',
      message:
        'Permanently deletes every transaction, points-ledger row, milestone and archived cycle, removes the Gmail link, and clears renewal/fee dates stamped onto your cards.\n\nYour cards and their benefits are kept. Nothing is archived — this is a hard dev reset, not a cycle close, and it cannot be undone.',
      icon: 'trash-outline',
      confirmLabel: 'Clear everything',
      destructive: true,
    });
    if (!ok) return;

    setBusy('txns');
    try {
      const counts = await devClearActivityData(user.id);
      invalidateEverything();
      setLastResult(summarise(counts));
      showDialog({
        title: 'Data cleared',
        message: summarise(counts),
        icon: 'checkmark-circle-outline',
        tone: 'green',
      });
    } catch (err) {
      logger.warn('[dev] Clear activity data failed', err);
      showDialog({
        title: 'Reset failed',
        message: err instanceof Error ? err.message : 'Something went wrong.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Eyebrow color={palette.indigo}>Internal</Eyebrow>
          <AppText variant="h2">Dev tools</AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.huge },
        ]}
      >
        <GlassCard style={styles.card}>
          <View style={styles.cardHead}>
            <IconBadge icon="trash-outline" tone="amber" size={40} />
            <View style={styles.cardHeadText}>
              <AppText variant="title">Clear all activity data</AppText>
              <AppText variant="caption" color={palette.textTertiary}>
                Destructive · no archive
              </AppText>
            </View>
          </View>
          <AppText variant="small" color={palette.textSecondary}>
            Deletes every transaction, points-ledger row, milestone and archived
            cycle, removes the Gmail link, clears renewal/fee dates stamped onto
            cards, and forgets the last-processed clipboard paste. Cards and
            their benefits are kept.
          </AppText>
          <PillButton
            label="Clear all activity data"
            icon="trash-outline"
            tone="danger"
            fullWidth
            loading={busy === 'txns'}
            disabled={busy !== null}
            onPress={onClearActivity}
          />
        </GlassCard>

        {lastResult ? (
          <GlassCard style={styles.card}>
            <AppText variant="title">Last run</AppText>
            <AppText variant="small" color={palette.textSecondary} style={styles.mono}>
              {lastResult}
            </AppText>
          </GlassCard>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  back: { padding: spacing.xs },
  headerText: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  card: { gap: spacing.md },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardHeadText: { flex: 1, gap: 2 },
  mono: { lineHeight: 20 },
  denied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  center: { textAlign: 'center' },
});
