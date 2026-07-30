/**
 * MilestoneRingCard + FeePaybackBar — Card Detail progress / fee facts.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { RadialProgress } from '@/components/ui/RadialProgress';
import { CountUpText } from '@/components/ui/CountUpText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PillButton } from '@/components/ui/PillButton';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { formatInr } from '@/lib/cardUtils';
import type { MilestoneCycle } from '@/lib/milestoneReset';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export interface MilestoneRingData {
  spent: number;
  threshold: number;
  progress: number;
  remaining: number;
  rewardDescription: string;
  isEstimated?: boolean;
}

export function MilestoneRingCard({
  data,
  play,
  pastCycles = [],
  onReset,
  resetLoading,
}: {
  data: MilestoneRingData;
  play: boolean;
  pastCycles?: MilestoneCycle[];
  onReset?: () => Promise<void> | void;
  resetLoading?: boolean;
}) {
  const palette = usePalette();
  const done = data.remaining <= 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [amountKey, setAmountKey] = useState(0);

  const openConfirm = () => {
    setMenuOpen(false);
    setTimeout(() => setConfirmOpen(true), 180);
  };

  const handleConfirmReset = async () => {
    if (!onReset) return;
    await onReset();
    setConfirmOpen(false);
    setAmountKey((k) => k + 1);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Eyebrow color={palette.indigo}>Milestone spend</Eyebrow>
        <View style={styles.headRight}>
          {data.isEstimated ? <ConfidenceBadge kind="estimated" /> : null}
          {onReset ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Milestone options"
              style={[
                styles.overflowBtn,
                {
                  backgroundColor: palette.glassFill,
                  borderColor: palette.glassBorder,
                },
              ]}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={palette.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <GlassCard style={styles.ringCard} padding={spacing.xl}>
        <RadialProgress
          progress={data.progress}
          play={play}
          size={188}
          strokeWidth={15}
        >
          <View style={styles.ringCenter}>
            {play ? (
              <CountUpText
                key={`amt-${amountKey}-${data.spent}`}
                value={formatInr(data.spent)}
                variant="h2"
                color={palette.textPrimary}
              />
            ) : (
              <AppText variant="h2">{formatInr(0)}</AppText>
            )}
            <AppText variant="small" color={palette.textTertiary}>
              of {formatInr(data.threshold)}
            </AppText>
          </View>
        </RadialProgress>

        <View style={styles.ringMeta}>
          {done ? (
            <AppText variant="body" color={palette.green} style={styles.centerText}>
              Milestone reached — {data.rewardDescription}
            </AppText>
          ) : (
            <AppText variant="body" color={palette.textSecondary} style={styles.centerText}>
              <AppText variant="body" color={palette.textPrimary}>
                {formatInr(data.remaining)}
              </AppText>{' '}
              more unlocks {data.rewardDescription}
            </AppText>
          )}
        </View>

        {pastCycles.length > 0 || onReset ? (
          <Pressable onPress={() => setHistoryOpen(true)} hitSlop={8}>
            <AppText variant="caption" color={palette.indigo} style={styles.pastLink}>
              Past cycles{pastCycles.length > 0 ? ` (${pastCycles.length})` : ''}
            </AppText>
          </Pressable>
        ) : null}
      </GlassCard>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <AppText variant="title">Milestone</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          Starts a new tracking period from today — useful after your card renews.
        </AppText>
        <PillButton
          label="Reset this milestone"
          icon="refresh-outline"
          onPress={openConfirm}
        />
      </BottomSheet>

      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <AppText variant="title">Reset milestone?</AppText>
        <AppText variant="body" color={palette.textSecondary}>
          Current progress ({formatInr(data.spent)} of {formatInr(data.threshold)}) will be
          archived. A fresh period starts today — past cycles stay in history.
        </AppText>
        <View style={styles.confirmActions}>
          <PillButton
            label="Cancel"
            variant="ghost"
            size="sm"
            onPress={() => setConfirmOpen(false)}
          />
          <PillButton
            label="Confirm reset"
            size="sm"
            icon="checkmark"
            loading={resetLoading}
            onPress={handleConfirmReset}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={historyOpen} onClose={() => setHistoryOpen(false)}>
        <AppText variant="title">Past cycles</AppText>
        {pastCycles.length === 0 ? (
          <AppText variant="small" color={palette.textTertiary}>
            No archived cycles yet. Reset or renew to start a history.
          </AppText>
        ) : (
          <View style={styles.cycleList}>
            {pastCycles.map((c) => (
              <View key={c.id} style={[styles.cycleRow, { borderBottomColor: palette.glassBorder }]}>
                <View style={styles.cycleTop}>
                  <AppText variant="small">
                    {c.periodStart} → {c.periodEnd}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={c.wasAchieved ? palette.green : palette.textTertiary}
                  >
                    {c.wasAchieved ? 'Achieved' : 'Not reached'}
                  </AppText>
                </View>
                <AppText variant="caption" color={palette.textSecondary}>
                  {formatInr(c.finalSpend)} of {formatInr(c.targetSpend)} ·{' '}
                  {c.closedReason === 'manual_reset'
                    ? 'Manual reset'
                    : c.closedReason === 'auto_renewal'
                      ? 'Auto renewal'
                      : 'Period expired'}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

/**
 * Annual fee (user-entered fact) with a pointer to listed benefits.
 * Does not show value_estimate sums or “payback %” — those invent numbers.
 */
export function FeePaybackBar({
  annualFee,
  benefitCount = 0,
}: {
  annualFee: number;
  /** @deprecated Ignored — catalog value sums are not displayed. */
  recovered?: number;
  play?: boolean;
  benefitCount?: number;
}) {
  const palette = usePalette();
  const safeFee = Number.isFinite(annualFee) ? Math.max(0, annualFee) : 0;
  if (safeFee <= 0) return null;

  return (
    <View style={styles.section}>
      <Eyebrow color={palette.indigo}>Annual fee</Eyebrow>
      <GlassCard style={styles.feeCard} padding={spacing.xl}>
        <AppText variant="stat" color={palette.textPrimary}>
          {formatInr(safeFee)}
        </AppText>
        <AppText variant="small" color={palette.textSecondary}>
          {benefitCount > 0
            ? `This card lists ${benefitCount} benefit${benefitCount === 1 ? '' : 's'} — review them below to judge value yourself.`
            : 'Add benefits on this card to see what it offers against this fee.'}
        </AppText>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingHorizontal: spacing.xl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  estBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  overflowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  ringCard: { alignItems: 'center', gap: spacing.lg },
  ringCenter: { alignItems: 'center', gap: 2 },
  ringMeta: { paddingHorizontal: spacing.sm },
  centerText: { textAlign: 'center', lineHeight: 22 },
  pastLink: { textAlign: 'center' },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cycleList: { gap: spacing.md, marginTop: spacing.sm },
  cycleRow: {
    gap: 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cycleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  feeCard: { gap: spacing.md },
});
