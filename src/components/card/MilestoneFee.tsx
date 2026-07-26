/**
 * MilestoneRingCard + FeePaybackBar — visual progress for the Card Detail
 * screen. Milestone ring includes reset overflow + past-cycle history.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { RadialProgress } from '@/components/ui/RadialProgress';
import { CountUpText } from '@/components/ui/CountUpText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PillButton } from '@/components/ui/PillButton';
import { formatInr } from '@/lib/cardUtils';
import { feePaybackPresentation } from '@/lib/feePayback';
import type { MilestoneCycle } from '@/lib/milestoneReset';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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
          {data.isEstimated ? (
            <View style={[styles.estBadge, { backgroundColor: palette.amberSoft }]}>
              <AppText variant="caption" color={palette.amber}>
                Estimated
              </AppText>
            </View>
          ) : null}
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
 * Benefit value against the annual fee. `benefitValue` is an estimated ceiling
 * from the catalog, not money recovered from spend, so the copy stays in
 * potential terms and the headline figure is never capped at 100%.
 */
export function FeePaybackBar({
  annualFee,
  recovered: benefitValue,
  play,
}: {
  annualFee: number;
  recovered: number;
  play: boolean;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const presentation = feePaybackPresentation(
    annualFee,
    benefitValue,
    formatInr,
  );
  const {
    safeFee,
    benefitValue: safeBenefitValue,
    progress: ratio,
    remaining,
    headline,
    summary,
  } = presentation;

  const fill = useSharedValue(0);
  useEffect(() => {
    if (!play) return;
    fill.value = reduced
      ? ratio
      : withTiming(ratio, {
          duration: motion.progressDuration,
          easing: Easing.out(Easing.cubic),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced, ratio]);

  const recoveredStyle = useAnimatedStyle(() => ({
    flex: Math.max(0.0001, fill.value),
  }));
  const remainingStyle = useAnimatedStyle(() => ({
    flex: Math.max(0.0001, 1 - fill.value),
  }));

  return (
    <View style={styles.section}>
      <Eyebrow color={palette.indigo}>Benefit value vs fee</Eyebrow>
      <GlassCard style={styles.feeCard} padding={spacing.xl}>
        <View style={styles.feeTopRow}>
          <AppText
            variant="stat"
            color={remaining > 0 ? palette.amber : palette.green}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
          >
            {headline}
          </AppText>
          <AppText
            variant="small"
            color={palette.textSecondary}
            style={styles.feeTopLabel}
          >
            {summary}
          </AppText>
        </View>

        <View style={[styles.feeBar, { backgroundColor: palette.trackBg }]}>
          <Animated.View style={[styles.segRecovered, { backgroundColor: palette.green }, recoveredStyle]} />
          <Animated.View style={[styles.segRemaining, { backgroundColor: palette.trackBg }, remainingStyle]} />
        </View>

        <View style={styles.feeLegend}>
          <Legend
            color={palette.green}
            label="Benefit value (est.)"
            value={formatInr(safeBenefitValue)}
          />
          <Legend
            color={palette.textSecondary}
            label="Annual fee"
            value={formatInr(safeFee)}
            muted
          />
        </View>
        <AppText variant="caption" color={palette.textTertiary}>
          Estimated from the card’s listed benefits — not spend-based, and not a
          guarantee of value you’ll actually use.
        </AppText>
      </GlassCard>
    </View>
  );
}

function Legend({
  color,
  label,
  value,
  muted,
}: {
  color: string;
  label: string;
  value: string;
  muted?: boolean;
}) {
  const palette = usePalette();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View style={styles.legendCopy}>
        <AppText variant="caption" color={palette.textTertiary}>
          {label}
        </AppText>
        <AppText variant="small" color={muted ? palette.textSecondary : palette.textPrimary}>
          {value}
        </AppText>
      </View>
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
  feeCard: { gap: spacing.lg },
  feeTopRow: { gap: spacing.xs },
  feeTopLabel: { maxWidth: '100%', lineHeight: 20 },
  feeBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segRecovered: {
    borderRadius: radius.pill,
  },
  segRemaining: {
    borderRadius: radius.pill,
  },
  feeLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexGrow: 1,
    flexBasis: 128,
    minWidth: 0,
  },
  legendCopy: { flex: 1, minWidth: 0 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
