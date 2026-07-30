/**
 * TrackChecklistPanel — Checklist tab matching Track reference card layout.
 *
 * Order: annual fees → stat tiles → statement upload (ADDITION beyond
 * reference) → milestones list → optional automatic tracking.
 *
 * Never dresses ₹0 / 0% as real data — hide those blocks when empty.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { PillButton } from '@/components/ui/PillButton';
import { CountUpText } from '@/components/ui/CountUpText';
import { RadialProgress } from '@/components/ui/RadialProgress';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TrackStatementSection } from '@/components/track/TrackStatementSection';
import { cardGlowAccent } from '@/components/vault/CardThemeGlow';
import { formatInr } from '@/lib/cardUtils';
import { annualFeesDueSoon, totalAnnualFees } from '@/lib/trackFees';
import { showDialog } from '@/stores/dialogStore';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VaultCard, CardColorTheme } from '@/types/card';
import type { MilestoneProgress, PointsExpiryItem } from '@/types/track';

/** Aggregate progress across all milestone cards (spent / threshold). */
function aggregateMilestoneProgress(milestones: MilestoneProgress[]): number {
  if (milestones.length === 0) return 0;
  const spent = milestones.reduce((s, m) => s + m.spent, 0);
  const threshold = milestones.reduce((s, m) => s + m.threshold, 0);
  if (threshold <= 0) return 0;
  return Math.min(1, spent / threshold);
}

/** Description under the card name — amount to go + reward, wraps to 2 lines. */
function milestoneDescription(m: MilestoneProgress): string {
  const reward = m.rewardDescription?.trim() || 'Milestone reward';
  if (m.progress >= 1) {
    return `Unlocked · ${reward}`;
  }
  return `${formatInr(m.remaining)} to go · ${reward}`;
}

function Entrance({
  delay,
  children,
  style,
}: {
  delay: number;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <AnimatedEntrance delay={delay} offsetY={14} style={style}>
      {children}
    </AnimatedEntrance>
  );
}

export function TrackChecklistPanel({
  cards,
  preferredStatementCardId = null,
  milestones,
  pointsExpiring,
  themeByCardId,
  onImportClipboard,
  onImportScreenshot,
  onAddCard,
  showOcr,
  delayBase = 0,
}: {
  cards: VaultCard[];
  preferredStatementCardId?: string | null;
  milestones: MilestoneProgress[];
  pointsExpiring: PointsExpiryItem[];
  themeByCardId: Record<string, CardColorTheme>;
  onImportClipboard: () => void;
  onImportScreenshot: () => void;
  onAddCard?: () => void;
  showOcr: boolean;
  delayBase?: number;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();

  const feesTotal = totalAnnualFees(cards);
  const feesDue = annualFeesDueSoon(cards);
  const overallProgress = aggregateMilestoneProgress(milestones);
  const overallPct = Math.round(overallProgress * 100);

  // Accuracy: only show when ledger/policy produced real expiry rows.
  const showPointsTile = pointsExpiring.length > 0;
  const showFeesCard = feesTotal > 0;
  const showMilestoneStat = milestones.length > 0;
  const pointsCountLabel = String(pointsExpiring.length).padStart(2, '0');

  // Dynamic length — never hardcoded to six (or any fixed count).
  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => b.progress - a.progress),
    [milestones],
  );

  const step = motion.staggerStep;

  if (cards.length === 0) {
    return (
      <Entrance delay={delayBase}>
        <GlassCard strong padding={spacing.xl} style={styles.emptyCard} elevation="raised">
          <Eyebrow color={palette.indigo}>Get started</Eyebrow>
          <AppText variant="title">Nothing to track yet</AppText>
          <AppText variant="body" color={palette.textSecondary}>
            Add a card to see annual fees, milestones, and spend progress —
            or explore optional import once you have cards in your vault.
          </AppText>
          {onAddCard ? (
            <PillButton
              label="Add a card"
              icon="add-outline"
              onPress={onAddCard}
              fullWidth
            />
          ) : null}
        </GlassCard>
      </Entrance>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* 1. Annual fees — only when real fee amounts exist */}
      {showFeesCard ? (
        <Entrance delay={delayBase}>
          <GlassCard strong padding={spacing.xl} style={styles.feesCard} elevation="raised">
            <View style={styles.feesTop}>
              <Eyebrow color={palette.textTertiary}>Annual fees</Eyebrow>
              {feesDue > 0 ? (
                <View
                  style={[styles.duePill, { backgroundColor: palette.danger }]}
                  accessibilityLabel={`${formatInr(feesDue)} due`}
                >
                  <AppText variant="caption" color={palette.textOnAccent}>
                    {formatInr(feesDue)} due
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.feesValueRow}>
              <CountUpText
                value={formatInr(feesTotal)}
                variant="h1"
                delay={delayBase + 80}
              />
              <AppText variant="small" color={palette.textTertiary} style={styles.perYear}>
                / year
              </AppText>
            </View>
          </GlassCard>
        </Entrance>
      ) : null}

      {/* 2. Stat tiles — only real milestone / points data */}
      {showMilestoneStat || showPointsTile ? (
        <View style={styles.statsRow}>
          {showMilestoneStat ? (
            <Entrance delay={delayBase + step} style={styles.statFlex}>
              <GlassCard style={styles.milestoneStat} padding={spacing.lg} elevation="flat">
                <RadialProgress
                  progress={overallProgress}
                  size={64}
                  strokeWidth={6}
                  showUnlockPulse={false}
                  play={!reduced}
                >
                  <CountUpText
                    value={`${overallPct}%`}
                    variant="title"
                    delay={delayBase + 120}
                  />
                </RadialProgress>
                <AppText
                  variant="small"
                  color={palette.textSecondary}
                  style={styles.milestoneStatLabel}
                >
                  Milestone{'\n'}progress
                </AppText>
              </GlassCard>
            </Entrance>
          ) : null}

          {showPointsTile ? (
            <Entrance delay={delayBase + step * 2} style={styles.statFlex}>
              <GlassCard style={styles.pointsStat} padding={spacing.lg} elevation="flat">
                <Ionicons name="sparkles" size={16} color={palette.indigo} />
                <CountUpText
                  value={pointsCountLabel}
                  variant="h1"
                  delay={delayBase + 140}
                />
                <AppText
                  variant="small"
                  color={palette.textSecondary}
                  style={styles.pointsLabel}
                >
                  Points expiring soon
                </AppText>
              </GlassCard>
            </Entrance>
          ) : null}
        </View>
      ) : null}

      {/*
        ADDITION BEYOND REFERENCE IMAGE
        Statement upload / spend summary is not in the redesign screenshot but
        must remain on Checklist (earlier product requirement). Card sits between
        the stat tiles and the MILESTONES header.
      */}
      <Entrance delay={delayBase + step * 3}>
        <TrackStatementSection
          cards={cards}
          preferredCardId={preferredStatementCardId}
        />
      </Entrance>

      {/* 3. Milestone cards — one GlassCard per item, scales with data */}
      {sortedMilestones.length > 0 ? (
        <Entrance delay={delayBase + step * 4}>
          <Eyebrow color={palette.textTertiary} style={styles.sectionEyebrow}>
            Milestones
          </Eyebrow>
          <View style={styles.milestoneList}>
            {sortedMilestones.map((m, i) => {
              const themeId = themeByCardId[m.cardId];
              const accent = themeId
                ? cardGlowAccent(themeId)
                : palette.indigo;
              const pct = Math.round(m.progress * 100);
              return (
                <AnimatedEntrance
                  key={`${m.cardId}-${m.source}-${m.threshold}`}
                  delay={delayBase + step * 4 + i * 55}
                  offsetY={10}
                >
                  <Pressable
                    onPress={() =>
                      showDialog({
                        title: m.cardNickname,
                        message: milestoneDescription(m),
                        icon: 'card-outline',
                        tone: 'indigo',
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${m.cardNickname}, ${pct} percent`}
                  >
                    <GlassCard
                      style={styles.milestoneCard}
                      padding={0}
                      elevation="flat"
                    >
                      <View style={styles.milestoneBody}>
                        <View style={[styles.avatar, { backgroundColor: accent }]}>
                          <Ionicons
                            name="card"
                            size={16}
                            color={palette.textOnAccent}
                          />
                        </View>
                        <View style={styles.milestoneMain}>
                          <View style={styles.milestoneTitleRow}>
                            <AppText
                              variant="body"
                              style={styles.cardName}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {m.cardNickname}
                            </AppText>
                            <AppText
                              variant="body"
                              color={palette.indigo}
                              style={styles.pct}
                            >
                              {pct}%
                            </AppText>
                          </View>
                          <AppText
                            variant="small"
                            color={palette.textSecondary}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {milestoneDescription(m)}
                          </AppText>
                        </View>
                      </View>
                      <View style={styles.barWrap}>
                        <ProgressBar progress={m.progress} height={4} />
                      </View>
                    </GlassCard>
                  </Pressable>
                </AnimatedEntrance>
              );
            })}
          </View>
        </Entrance>
      ) : null}

      {/* 4. Optional automatic tracking */}
      <Entrance delay={delayBase + step * 5}>
        <GlassCard style={styles.optionalCard} padding={spacing.xl} elevation="raised">
          <AppText variant="title">Optional: automatic tracking</AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            Improves milestones and points — not required to use KeyKards.
          </AppText>
          <View style={styles.pills}>
            <Pressable
              onPress={onImportClipboard}
              style={[styles.pill, { borderColor: palette.glassBorderStrong }]}
              accessibilityRole="button"
              accessibilityLabel="Import clipboard"
            >
              <Ionicons
                name="clipboard-outline"
                size={16}
                color={palette.textPrimary}
              />
              <AppText variant="small">Import clipboard</AppText>
            </Pressable>
            <Pressable
              onPress={onImportScreenshot}
              style={[
                styles.pill,
                {
                  borderColor: showOcr
                    ? palette.indigo
                    : palette.glassBorderStrong,
                  backgroundColor: showOcr ? palette.indigoSoft : 'transparent',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Paste alert text"
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={showOcr ? palette.indigo : palette.textPrimary}
              />
              <AppText
                variant="small"
                color={showOcr ? palette.indigo : palette.textPrimary}
              >
                Paste alert text
              </AppText>
            </Pressable>
            <View
              style={[
                styles.pill,
                styles.pillDisabled,
                { borderColor: palette.glassBorder },
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel="Gmail, coming soon"
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color={palette.textTertiary}
              />
              <AppText variant="small" color={palette.textTertiary}>
                Gmail · soon
              </AppText>
            </View>
          </View>
        </GlassCard>
      </Entrance>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  emptyCard: { gap: spacing.md },
  feesCard: { gap: spacing.md },
  feesTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  duePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  feesValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  perYear: { marginBottom: 4 },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statFlex: { flex: 1 },
  milestoneStat: {
    minHeight: 112,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  milestoneStatLabel: { flex: 1, lineHeight: 18 },
  pointsStat: {
    minHeight: 112,
    borderRadius: radius.lg,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
  },
  pointsLabel: { lineHeight: 18 },
  sectionEyebrow: { marginTop: spacing.xs },
  milestoneList: { gap: spacing.sm, marginTop: spacing.md },
  milestoneCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  milestoneBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneMain: { flex: 1, minWidth: 0, gap: 3 },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  pct: { flexShrink: 0, fontWeight: '600' },
  barWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  optionalCard: { gap: spacing.sm },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillDisabled: {
    opacity: 0.45,
  },
});
