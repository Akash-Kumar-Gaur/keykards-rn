/**
 * Track dashboard — overview hero + category sections.
 * All-cards: horizontal carousels. Single-card: full-width stacked tiles.
 * Accent chrome follows TrackTheme / card_color_theme (not a full restyle).
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { CountUpText } from '@/components/ui/CountUpText';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconBadge, type BadgeTone } from '@/components/ui/IconBadge';
import { RadialProgress } from '@/components/ui/RadialProgress';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { StatementSummary } from '@/components/statement/StatementSummary';
import { useLatestStatement } from '@/hooks/useStatementUpload';
import { useTrackAccentBgStyle, useTrackTheme } from '@/components/track/TrackTheme';
import { formatInr } from '@/lib/cardUtils';
import { feePaybackPresentation } from '@/lib/feePayback';
import { getCardTheme } from '@/lib/cardThemes';
import type { TrackAccentPair } from '@/lib/trackAccent';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type {
  FeePaybackStatus,
  MilestoneProgress,
  PointsExpiryItem,
  RenewalStatus,
  TrackSnapshot,
} from '@/types/track';
import type { CardColorTheme } from '@/types/card';

const CARD_W = 168;

function PressScale({
  children,
  onPress,
  /** Single-card mode: stretch to the section width. Never use inside the
   *  horizontal rail — `width: '100%'` there is circular with content sizing. */
  stretch = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  stretch?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.96, motion.springConfig);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.springConfig);
      }}
      onPress={onPress}
      style={stretch ? styles.stretch : undefined}
    >
      <Animated.View style={[stretch ? styles.stretch : null, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function AccentBar({ color }: { color: string }) {
  const themed = useTrackAccentBgStyle();
  // When a per-card color is provided (All-cards rail), use it statically;
  // when empty string, follow animated page accent.
  if (color) {
    return <View style={[styles.accentBar, { backgroundColor: color }]} />;
  }
  return <Animated.View style={[styles.accentBar, themed]} />;
}

function OverviewHero({
  snapshot,
  delay = 0,
  accent,
}: {
  snapshot: TrackSnapshot;
  delay?: number;
  accent: TrackAccentPair;
}) {
  const palette = usePalette();
  const pointsSoon = snapshot.pointsExpiring
    .filter((p) => p.daysUntil >= 0 && p.daysUntil <= 90)
    .reduce((s, p) => s + p.pointsAmount, 0);
  const benefitPotential = snapshot.feePayback.reduce(
    (s, f) => s + f.benefitValueSum,
    0,
  );
  const milestonesActive = snapshot.milestones.filter(
    (m) => m.spent > 0 && m.progress < 1,
  ).length;
  const renewalsSoon = snapshot.renewals.filter(
    (r) => r.daysUntil != null && r.daysUntil >= 0 && r.daysUntil <= 90,
  ).length;

  const tiles: Array<{
    label: string;
    value: string;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: BadgeTone;
    useAccent?: boolean;
  }> = [
    {
      label: 'Points soon',
      value:
        pointsSoon > 0 ? pointsSoon.toLocaleString('en-IN') : '0',
      sub: 'expiring ≤90d',
      icon: 'hourglass-outline',
      tone: 'amber',
    },
    {
      label: 'Benefit value',
      value: benefitPotential > 0 ? formatInr(benefitPotential) : formatInr(0),
      sub: 'potential, est.',
      icon: 'wallet-outline',
      tone: 'green',
    },
    {
      label: 'Milestones',
      value: String(milestonesActive),
      sub: 'in progress',
      icon: 'flag-outline',
      tone: 'indigo',
      useAccent: true,
    },
    {
      label: 'Renewals',
      value: String(renewalsSoon),
      sub: 'next 90 days',
      icon: 'calendar-outline',
      tone: 'amber',
    },
  ];

  return (
    <AnimatedEntrance delay={delay}>
      <View style={styles.heroGrid}>
        {tiles.map((t, i) => (
          <GlassCard key={t.label} style={styles.heroTile} padding={spacing.md}>
            <IconBadge
              icon={t.icon}
              tone={t.tone}
              size={30}
              accentColor={t.useAccent ? accent.accent : undefined}
            />
            <AppText variant="caption" color={palette.textTertiary}>
              {t.label}
            </AppText>
            <CountUpText
              value={t.value}
              delay={delay + 80 + i * 60}
              style={styles.heroValue}
            />
            <AppText variant="caption" color={palette.textSecondary} numberOfLines={1}>
              {t.sub}
            </AppText>
          </GlassCard>
        ))}
      </View>
    </AnimatedEntrance>
  );
}

function CarouselHeader({
  title,
  count,
  icon,
  accent,
}: {
  title: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent: TrackAccentPair;
}) {
  const palette = usePalette();
  return (
    <View style={styles.carouselHead}>
      <IconBadge icon={icon} tone="indigo" size={28} accentColor={accent.accent} />
      <AppText variant="title" style={styles.carouselTitle}>
        {title}
      </AppText>
      <AppText variant="caption" color={palette.textTertiary}>
        · {count}
      </AppText>
    </View>
  );
}

function ItemRail({
  single,
  children,
}: {
  single: boolean;
  children: React.ReactNode;
}) {
  // Single-card: plain column — no horizontal ScrollView, no snap/rail sizing.
  if (single) {
    return <View style={styles.stack}>{children}</View>;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      decelerationRate="fast"
      snapToInterval={CARD_W + spacing.md}
      snapToAlignment="start"
    >
      {children}
    </ScrollView>
  );
}

function tileStyle(single: boolean, tall?: boolean) {
  if (single) {
    // Full-bleed tiles; tall only needs room for the ring row (not carousel height).
    return [styles.tileFull, tall ? styles.tileFullTall : null];
  }
  return [styles.tile, tall ? styles.tileTall : null];
}

function cardAccent(
  cardId: string,
  themeByCardId: Record<string, CardColorTheme>,
  pageAccent: string,
  single: boolean,
): string {
  if (single) return ''; // animated AccentBar follows page theme
  const themeId = themeByCardId[cardId];
  return themeId ? getCardTheme(themeId).colors[0] : pageAccent;
}

function ringColors(
  cardId: string,
  themeByCardId: Record<string, CardColorTheme>,
  accent: TrackAccentPair,
  single: boolean,
): { color: string; colorDeep: string } {
  if (single) return { color: accent.accent, colorDeep: accent.accentDeep };
  const themeId = themeByCardId[cardId];
  if (!themeId) return { color: accent.accent, colorDeep: accent.accentDeep };
  const t = getCardTheme(themeId);
  return { color: t.colors[0], colorDeep: t.colors[1] };
}

function PointsCarousel({
  items,
  single,
  accent,
  themeByCardId,
}: {
  items: PointsExpiryItem[];
  single: boolean;
  accent: TrackAccentPair;
  themeByCardId: Record<string, CardColorTheme>;
}) {
  const palette = usePalette();
  const router = useRouter();
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.daysUntil - b.daysUntil),
    [items],
  );
  if (sorted.length === 0) return null;
  return (
    <ScrollReveal>
      <View style={styles.section}>
        <CarouselHeader
          title="Points expiring soon"
          count={sorted.length}
          icon="hourglass-outline"
          accent={accent}
        />
        {(
          <ItemRail single={single}>
            {sorted.map((p) => (
              <PressScale
                key={p.id}
                stretch={single}
                onPress={() =>
                  router.push(`/card/${p.cardId}?section=points` as Href)
                }
              >
                <GlassCard style={tileStyle(single)} padding={spacing.md}>
                  <AccentBar
                    color={cardAccent(p.cardId, themeByCardId, accent.accent, single)}
                  />
                  <IconBadge icon="hourglass-outline" tone="amber" size={28} />
                  <AppText variant="title" numberOfLines={1}>
                    {p.pointsAmount.toLocaleString('en-IN')}
                  </AppText>
                  {!single ? (
                    <AppText variant="caption" color={palette.textSecondary} numberOfLines={1}>
                      {p.cardNickname}
                    </AppText>
                  ) : null}
                  <AppText variant="small" color={palette.amber}>
                    {p.daysUntil >= 0 ? `${p.daysUntil}d left` : 'Expired'}
                  </AppText>
                </GlassCard>
              </PressScale>
            ))}
          </ItemRail>
        )}
      </View>
    </ScrollReveal>
  );
}

function MilestoneCarousel({
  items,
  single,
  accent,
  themeByCardId,
}: {
  items: MilestoneProgress[];
  single: boolean;
  accent: TrackAccentPair;
  themeByCardId: Record<string, CardColorTheme>;
}) {
  const palette = usePalette();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <ScrollReveal>
      <View style={styles.section}>
        <CarouselHeader
          title="Milestones"
          count={items.length}
          icon="flag-outline"
          accent={accent}
        />
        {(
          <ItemRail single={single}>
            {items.map((m) => {
              const ring = ringColors(m.cardId, themeByCardId, accent, single);
              return (
                <PressScale
                  key={m.cardId}
                  stretch={single}
                  onPress={() =>
                    router.push(`/card/${m.cardId}?section=milestones` as Href)
                  }
                >
                  <GlassCard
                    style={tileStyle(single, true)}
                    padding={spacing.md}
                  >
                    <View style={single ? styles.fullRow : styles.centeredCol}>
                      <RadialProgress
                        progress={m.progress}
                        size={single ? 88 : 72}
                        strokeWidth={8}
                        showUnlockPulse={m.progress >= 0.95}
                        color={ring.color}
                        colorDeep={ring.colorDeep}
                      >
                        <AppText variant="caption" color={palette.textPrimary}>
                          {Math.round(m.progress * 100)}%
                        </AppText>
                      </RadialProgress>
                      <View style={single ? styles.fullMeta : undefined}>
                        {!single ? (
                          <AppText variant="small" numberOfLines={1}>
                            {m.cardNickname}
                          </AppText>
                        ) : (
                          <AppText variant="body" numberOfLines={2}>
                            {m.rewardDescription || 'Milestone'}
                          </AppText>
                        )}
                        <AppText
                          variant="caption"
                          color={palette.textTertiary}
                          numberOfLines={2}
                        >
                          {formatInr(m.remaining)} to go
                        </AppText>
                      </View>
                    </View>
                  </GlassCard>
                </PressScale>
              );
            })}
          </ItemRail>
        )}
      </View>
    </ScrollReveal>
  );
}

function RenewalsCarousel({
  items,
  single,
  accent,
}: {
  items: RenewalStatus[];
  single: boolean;
  accent: TrackAccentPair;
}) {
  const palette = usePalette();
  const router = useRouter();
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999)),
    [items],
  );
  if (sorted.length === 0) return null;
  return (
    <ScrollReveal>
      <View style={styles.section}>
        <CarouselHeader
          title="Upcoming renewals"
          count={sorted.length}
          icon="calendar-outline"
          accent={accent}
        />
        {(
          <ItemRail single={single}>
            {sorted.map((r) => (
              <PressScale
                key={r.cardId}
                stretch={single}
                onPress={() =>
                  router.push(`/card/${r.cardId}?section=renewal` as Href)
                }
              >
                <GlassCard style={tileStyle(single)} padding={spacing.md}>
                  <IconBadge icon="calendar-outline" tone="amber" size={28} />
                  {!single ? (
                    <AppText variant="small" numberOfLines={1}>
                      {r.cardNickname}
                    </AppText>
                  ) : null}
                  <AppText variant="title" numberOfLines={1}>
                    {r.renewalDate.slice(5) || r.renewalDate}
                  </AppText>
                  <AppText variant="caption" color={palette.textSecondary}>
                    {r.daysUntil != null
                      ? r.daysUntil >= 0
                        ? `in ${r.daysUntil}d`
                        : `${Math.abs(r.daysUntil)}d ago`
                      : r.isConfirmed
                        ? 'Confirmed'
                        : 'Estimated'}
                  </AppText>
                </GlassCard>
              </PressScale>
            ))}
          </ItemRail>
        )}
      </View>
    </ScrollReveal>
  );
}

function FeePaybackCarousel({
  items,
  single,
  accent,
  themeByCardId,
}: {
  items: FeePaybackStatus[];
  single: boolean;
  accent: TrackAccentPair;
  themeByCardId: Record<string, CardColorTheme>;
}) {
  const palette = usePalette();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <ScrollReveal>
      <View style={styles.section}>
        <CarouselHeader
          title="Benefit value vs fee"
          count={items.length}
          icon="wallet-outline"
          accent={accent}
        />
        {(
          <ItemRail single={single}>
            {items.map((f) => {
              const payback = feePaybackPresentation(
                f.annualFee,
                f.benefitValueSum,
                formatInr,
              );
              const ring = ringColors(f.cardId, themeByCardId, accent, single);
              return (
                <PressScale
                  key={f.cardId}
                  stretch={single}
                  onPress={() =>
                    router.push(`/card/${f.cardId}?section=fee` as Href)
                  }
                >
                  <GlassCard
                    style={tileStyle(single, true)}
                    padding={spacing.md}
                  >
                    <View style={single ? styles.fullRow : styles.centeredCol}>
                      <RadialProgress
                        progress={payback.progress}
                        size={single ? 88 : 72}
                        strokeWidth={8}
                        showUnlockPulse={false}
                        color={ring.color}
                        colorDeep={ring.colorDeep}
                      >
                        <AppText variant="caption" color={palette.textPrimary}>
                          {payback.headline}
                        </AppText>
                      </RadialProgress>
                      <View style={single ? styles.fullMeta : undefined}>
                        {!single ? (
                          <AppText variant="small" numberOfLines={1}>
                            {f.cardNickname}
                          </AppText>
                        ) : null}
                        <AppText
                          variant="caption"
                          color={palette.textSecondary}
                          numberOfLines={1}
                        >
                          Value {formatInr(payback.benefitValue)}
                        </AppText>
                        <AppText
                          variant="caption"
                          color={palette.textTertiary}
                          numberOfLines={1}
                        >
                          Fee {formatInr(payback.safeFee)}
                        </AppText>
                      </View>
                    </View>
                  </GlassCard>
                </PressScale>
              );
            })}
          </ItemRail>
        )}
      </View>
    </ScrollReveal>
  );
}

/**
 * Spend analysis for the selected card. Once a statement has been parsed for
 * this card, the actual breakdown (totals, category donut, notable txns) is
 * rendered inline — the upload CTA is only shown while there is genuinely no
 * statement data yet.
 */
function StatementSection({ cardId, accent }: { cardId: string; accent: TrackAccentPair }) {
  const palette = usePalette();
  const router = useRouter();
  const { data: latest } = useLatestStatement(cardId);
  const goStatement = () => router.push(`/card/${cardId}/statement` as Href);

  if (!latest) {
    return (
      <ScrollReveal>
        <PressScale stretch onPress={goStatement}>
          <GlassCard style={styles.statementCta} padding={spacing.lg}>
            <IconBadge
              icon="document-text-outline"
              tone="indigo"
              size={36}
              accentColor={accent.accent}
            />
            <View style={styles.statementText}>
              <AppText variant="title">Statement summary</AppText>
              <AppText variant="caption" color={palette.textSecondary}>
                Upload this cycle’s PDF for a full spend breakdown
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accent.accent} />
          </GlassCard>
        </PressScale>
      </ScrollReveal>
    );
  }

  const spendChangePct =
    latest.priorPeriodSpend && latest.priorPeriodSpend > 0
      ? ((latest.totalSpend - latest.priorPeriodSpend) / latest.priorPeriodSpend) *
        100
      : null;

  return (
    <ScrollReveal>
      <View style={styles.section}>
        <StatementSummary data={latest} spendChangePct={spendChangePct} />
        <PressScale stretch onPress={goStatement}>
          <GlassCard style={styles.statementUpdate} padding={spacing.md}>
            <Ionicons name="refresh-outline" size={18} color={accent.accent} />
            <AppText variant="small" color={palette.textSecondary} style={styles.statementUpdateText}>
              Upload a newer statement PDF
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
          </GlassCard>
        </PressScale>
      </View>
    </ScrollReveal>
  );
}

export function TrackDashboard({
  snapshot,
  hasCards,
  singleCard = false,
  selectedCardId = null,
  accent,
  themeByCardId,
}: {
  snapshot: TrackSnapshot | undefined;
  hasCards: boolean;
  /** When true, sections use full-width tiles instead of horizontal rails. */
  singleCard?: boolean;
  selectedCardId?: string | null;
  accent: TrackAccentPair;
  themeByCardId: Record<string, CardColorTheme>;
}) {
  useTrackTheme();
  const palette = usePalette();

  if (!hasCards) {
    return (
      <AnimatedEntrance>
        <View style={styles.globalEmpty}>
          <IconBadge
            icon="card-outline"
            tone="indigo"
            size={48}
            accentColor={accent.accent}
          />
          <AppText variant="title">Nothing to track yet</AppText>
          <AppText variant="small" color={palette.textSecondary} style={styles.center}>
            Add a card to your vault and we’ll start tracking milestones, points, and
            renewals here.
          </AppText>
        </View>
      </AnimatedEntrance>
    );
  }

  const data: TrackSnapshot = snapshot ?? {
    milestones: [],
    feePayback: [],
    pointsExpiring: [],
    renewals: [],
    pendingCount: 0,
    gmailConnected: false,
  };

  const quiet =
    data.milestones.length === 0 &&
    data.feePayback.length === 0 &&
    data.pointsExpiring.length === 0 &&
    data.renewals.length === 0;

  return (
    <View style={styles.dashboard}>
      {selectedCardId ? (
        <StatementSection cardId={selectedCardId} accent={accent} />
      ) : null}
      {quiet ? (
        <AnimatedEntrance delay={motion.staggerStep * 2}>
          <View style={styles.globalEmpty}>
            <IconBadge
              icon="sparkles-outline"
              tone="indigo"
              size={44}
              accentColor={accent.accent}
            />
            <AppText variant="small" color={palette.textSecondary} style={styles.center}>
              Add a few transactions and we’ll start tracking points, milestones,
              and renewals here.
            </AppText>
          </View>
        </AnimatedEntrance>
      ) : (
        <>
          <OverviewHero snapshot={data} delay={motion.staggerStep} accent={accent} />
          {/* Each carousel hides itself entirely when it has no real entries —
              no empty placeholder tiles once cards exist. */}
          <PointsCarousel
            items={data.pointsExpiring}
            single={singleCard}
            accent={accent}
            themeByCardId={themeByCardId}
          />
          <MilestoneCarousel
            items={data.milestones}
            single={singleCard}
            accent={accent}
            themeByCardId={themeByCardId}
          />
          <RenewalsCarousel
            items={data.renewals}
            single={singleCard}
            accent={accent}
          />
          <FeePaybackCarousel
            items={data.feePayback}
            single={singleCard}
            accent={accent}
            themeByCardId={themeByCardId}
          />
        </>
      )}
    </View>
  );
}

/** Compact width helper for tests / layout notes — rail cards stay fixed. */
export function trackCarouselCardWidth(_screenWidth: number): number {
  return CARD_W;
}

const styles = StyleSheet.create({
  dashboard: { gap: spacing.xl },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroTile: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    gap: spacing.xs,
    minHeight: 112,
  },
  heroValue: { marginTop: 2 },
  section: { gap: spacing.sm, alignSelf: 'stretch', width: '100%' },
  carouselHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  carouselTitle: { flexShrink: 1 },
  rail: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xl,
  },
  stack: {
    gap: spacing.md,
    alignSelf: 'stretch',
    width: '100%',
  },
  /** Forces PressScale → tile to fill the section in single-card mode. */
  stretch: {
    alignSelf: 'stretch',
    width: '100%',
  },
  tile: {
    width: CARD_W,
    gap: spacing.sm,
    minHeight: 132,
    overflow: 'hidden',
  },
  tileFull: {
    alignSelf: 'stretch',
    width: '100%',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  tileTall: {
    minHeight: 168,
  },
  /** Single-card tall tiles only need the ring row — not carousel card height. */
  tileFullTall: {
    minHeight: 112,
  },
  centeredCol: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    width: '100%',
    gap: spacing.lg,
  },
  fullMeta: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  globalEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  center: { textAlign: 'center' },
  statementCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    width: '100%',
  },
  statementText: { flex: 1, flexShrink: 1, minWidth: 0, gap: 2 },
  statementUpdate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    width: '100%',
  },
  statementUpdateText: { flex: 1, flexShrink: 1, minWidth: 0 },
});
