/**
 * Card detail — a hero flip-card with progressive-disclosure sections:
 * quick chips, an explorable benefits carousel, a milestone radial ring, a fee
 * payback segmented bar, and points/renewal stat tiles. Edit/Delete live behind
 * the header (⋯) overflow menu. Sections fade+slide in as they scroll into view.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import {
  RevealSection,
  ScrollReveal,
  ScrollRevealProvider,
} from '@/components/ui/ScrollReveal';
import { FlipRevealCard } from '@/components/vault/FlipRevealCard';
import { RevealAffordance } from '@/components/card/RevealAffordance';
import { QuickChips, type QuickChip } from '@/components/card/QuickChips';
import { BenefitsExplorer } from '@/components/card/BenefitsExplorer';
import {
  MilestoneRingCard,
  FeePaybackBar,
  type MilestoneRingData,
} from '@/components/card/MilestoneFee';
import { MilestoneResetNoticeBanner } from '@/components/card/MilestoneResetNoticeBanner';
import { CardholderNameSheet } from '@/components/vault/CardholderNameSheet';
import { TrackStatCards } from '@/components/card/TrackStatCards';
import {
  CardOverflowMenu,
  OverflowButton,
  type OverflowAction,
} from '@/components/card/CardOverflowMenu';
import { useAuthStore } from '@/stores/authStore';
import { confirmDialog, showDialog } from '@/stores/dialogStore';
import {
  useCard,
  useCardBenefits,
  useCardMilestones,
  useDeleteCard,
  useMilestoneCycles,
} from '@/hooks/useCards';
import {
  periodMonthsFromPolicy,
  useResetCardMilestone,
} from '@/hooks/useMilestoneReset';
import { useTrackSnapshot } from '@/hooks/useTrackData';
import { usePointsLedger } from '@/hooks/useTransactions';
import { logger } from '@/lib/logger';
import { spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { CatalogPolicyFields, RenewalStatus } from '@/types/track';

const OVERFLOW_ACTIONS: OverflowAction[] = [
  { id: 'edit', label: 'Edit card', icon: 'create-outline' },
  { id: 'manage', label: 'Benefits & milestones', icon: 'gift-outline' },
  { id: 'statement', label: 'Upload statement', icon: 'document-text-outline' },
  { id: 'shares', label: 'Shared links', icon: 'link-outline' },
  { id: 'delete', label: 'Delete card', icon: 'trash-outline', destructive: true },
];

export default function CardDetailScreen() {
  const palette = usePalette();
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: card, isLoading } = useCard(id);
  const { data: benefits = [] } = useCardBenefits(id);
  const { data: milestones = [] } = useCardMilestones(id);
  const { data: snapshot } = useTrackSnapshot(userId);
  const { data: ledger = [] } = usePointsLedger(userId);
  const deleteCard = useDeleteCard(userId);
  const resetMilestone = useResetCardMilestone();
  const activeMilestoneId = milestones[0]?.id;
  const { data: pastCycles = [] } = useMilestoneCycles(activeMilestoneId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const sectionY = useRef<Record<string, number>>({});

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const jumpTo = (key: string) => {
    const y = sectionY.current[key];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 88), animated: true });
  };

  // Deep-link from Track carousels: /card/:id?section=fee|benefits|milestones|points|renewal
  useEffect(() => {
    if (!card || !section) return;
    const map: Record<string, string> = {
      benefits: 'benefits',
      fee: 'fee',
      milestones: 'milestones',
      points: 'stats',
      renewal: 'stats',
    };
    const target = map[section] ?? 'benefits';
    const t = setTimeout(() => jumpTo(target), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, section]);

  // --- Derived Track views for this card -------------------------------------
  const milestoneData: MilestoneRingData | null = useMemo(() => {
    const fromSnapshot = snapshot?.milestones.find((m) => m.cardId === id);
    if (fromSnapshot) {
      return {
        spent: fromSnapshot.spent,
        threshold: fromSnapshot.threshold,
        progress: fromSnapshot.progress,
        remaining: fromSnapshot.remaining,
        rewardDescription: fromSnapshot.rewardDescription,
        isEstimated: fromSnapshot.source === 'catalog_policy',
      };
    }
    const manual = milestones[0];
    if (manual && manual.targetSpend > 0) {
      const progress = Math.min(1, manual.currentSpend / manual.targetSpend);
      return {
        spent: manual.currentSpend,
        threshold: manual.targetSpend,
        progress,
        remaining: Math.max(0, manual.targetSpend - manual.currentSpend),
        rewardDescription: manual.rewardDescription,
        isEstimated: false,
      };
    }
    return null;
  }, [snapshot, milestones, id]);

  const feeData = useMemo(() => {
    if (card?.annualFee && card.annualFee > 0) {
      return {
        annualFee: card.annualFee,
        benefitCount: benefits.length,
      };
    }
    const fromSnapshot = snapshot?.feePayback.find((f) => f.cardId === id);
    if (fromSnapshot && fromSnapshot.annualFee > 0) {
      return {
        annualFee: fromSnapshot.annualFee,
        benefitCount: benefits.length,
      };
    }
    return null;
  }, [snapshot, card, benefits, id]);

  const pointsItems = useMemo(
    () => snapshot?.pointsExpiring.filter((p) => p.cardId === id) ?? [],
    [snapshot, id],
  );

  const cardLedger = useMemo(
    () => ledger.filter((l) => l.cardId === id),
    [ledger, id],
  );

  const renewal: RenewalStatus | null = useMemo(() => {
    const fromSnapshot = snapshot?.renewals.find((r) => r.cardId === id);
    if (fromSnapshot) return fromSnapshot;
    if (!card) return null;
    const date = card.renewalDateConfirmed ?? card.renewalDateEstimated;
    if (!date) return null;
    const days = Math.round(
      (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return {
      cardId: card.id,
      cardNickname: card.nickname,
      bankName: card.bankName,
      renewalDate: date,
      isConfirmed: Boolean(card.renewalDateConfirmed),
      daysUntil: Number.isFinite(days) ? days : null,
    };
  }, [snapshot, card, id]);

  const quickChips: QuickChip[] = useMemo(() => {
    if (!card) return [];
    // Network + last 4 are glance-only (one pill). Fee jumps to a section.
    // Share lives in the header (primary) and overflow (secondary).
    const chips: QuickChip[] = [
      {
        id: 'identity',
        label: `${card.network} · •••• ${card.lastFour}`,
        icon: 'card-outline',
      },
    ];
    if (renewal?.daysUntil != null) {
      const soon = renewal.daysUntil <= 45;
      chips.push({
        id: 'fee',
        label: renewal.isConfirmed
          ? `Fee due in ${Math.max(0, renewal.daysUntil)}d`
          : `Fee due ~${Math.max(0, renewal.daysUntil)}d (est.)`,
        icon: 'calendar-outline',
        tone: soon ? 'amber' : 'green',
        target: 'fee',
      });
    } else if (card.annualFee != null && card.annualFee > 0) {
      chips.push({
        id: 'fee',
        label: 'Fee payback',
        icon: 'trending-up-outline',
        target: 'fee',
      });
    }
    return chips;
  }, [card, renewal]);

  const onDelete = async () => {
    if (!card) return;
    const ok = await confirmDialog({
      title: 'Delete this card?',
      message: `"${card.nickname}" and all its benefits and milestones will be permanently removed. This can’t be undone.`,
      icon: 'trash-outline',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCard.mutateAsync(card.id);
      router.replace('/(tabs)/vault');
    } catch (err) {
      logger.warn('Delete card failed', err);
      showDialog({
        title: 'Delete failed',
        message: 'That card could not be removed. Please try again.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    }
  };

  const onOverflowSelect = (action: string) => {
    if (!card) return;
    if (action === 'edit') router.push(`/card/${card.id}/edit` as Href);
    else if (action === 'manage') router.push(`/card/${card.id}/extras` as Href);
    else if (action === 'statement')
      router.push(`/card/${card.id}/statement` as Href);
    else if (action === 'shares')
      router.push(`/card/${card.id}/shares` as Href);
    else if (action === 'delete') onDelete();
  };

  const milestonePolicy: CatalogPolicyFields | null = useMemo(() => {
    const fromSnapshot = snapshot?.milestones.find((m) => m.cardId === id);
    if (fromSnapshot) {
      return {
        milestoneThreshold: fromSnapshot.threshold,
        milestonePeriodMonths: fromSnapshot.periodMonths,
        milestoneRewardDescription: fromSnapshot.rewardDescription,
        feeWaiverSpendThreshold: null,
        pointsExpiryPolicyMonths: null,
      };
    }
    const manual = milestones[0];
    if (manual) {
      return {
        milestoneThreshold: manual.targetSpend,
        milestonePeriodMonths: periodMonthsFromPolicy(null, manual),
        milestoneRewardDescription: manual.rewardDescription,
        feeWaiverSpendThreshold: null,
        pointsExpiryPolicyMonths: null,
      };
    }
    return null;
  }, [snapshot, milestones, id]);

  const handleMilestoneReset = async () => {
    if (!card || !userId || !milestonePolicy) return;
    try {
      await resetMilestone.mutateAsync({
        cardId: card.id,
        cardNickname: card.nickname,
        userId,
        reason: 'manual_reset',
        periodMonths: periodMonthsFromPolicy(milestonePolicy, milestones[0]),
        policy: milestonePolicy,
        notify: false,
      });
    } catch (err) {
      logger.warn('Manual milestone reset failed', err);
      showDialog({
        title: 'Reset failed',
        message: 'This milestone could not be reset. Please try again.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    }
  };

  return (
    <View style={styles.root}>
      <GlowBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Eyebrow color={palette.indigo}>{card?.bankName ?? 'Vault'}</Eyebrow>
          <AppText variant="h2" numberOfLines={1}>
            {card?.nickname ?? 'Card'}
          </AppText>
        </View>
        {card ? <OverflowButton onPress={() => setMenuOpen(true)} /> : null}
      </View>

      <MilestoneResetNoticeBanner />

      {isLoading && !card ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.indigo} />
        </View>
      ) : null}

      {!isLoading && !card ? (
        <View style={styles.center}>
          <AppText color={palette.amber}>Card not found.</AppText>
        </View>
      ) : null}

      {card ? (
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => {
            viewportH.value = e.nativeEvent.layout.height;
          }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.huge },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ScrollRevealProvider scrollY={scrollY} viewportH={viewportH}>
            <AnimatedEntrance>
              <View style={styles.hero}>
                <FlipRevealCard
                  card={card}
                  onRecoveryNeeded={() =>
                    router.push(`/card/${card.id}/edit` as Href)
                  }
                  onEditCardholderName={() => setNameSheetOpen(true)}
                  onShare={() => router.push(`/card/${card.id}/share` as Href)}
                />
                <RevealAffordance cardId={card.id} />
              </View>
            </AnimatedEntrance>

            <AnimatedEntrance delay={motion.staggerStep}>
              <QuickChips chips={quickChips} onJump={jumpTo} />
            </AnimatedEntrance>

            <RevealSection
              onMeasureY={(y) => {
                sectionY.current.benefits = y;
              }}
            >
              {(play) => (
                <BenefitsExplorer
                  benefits={benefits}
                  play={play}
                  onManage={() => router.push(`/card/${card.id}/extras` as Href)}
                />
              )}
            </RevealSection>

            {milestoneData ? (
              <RevealSection
                onMeasureY={(y) => {
                  sectionY.current.milestones = y;
                }}
              >
                {(play) => (
                  <MilestoneRingCard
                    data={milestoneData}
                    play={play}
                    pastCycles={pastCycles}
                    resetLoading={resetMilestone.isPending}
                    onReset={handleMilestoneReset}
                  />
                )}
              </RevealSection>
            ) : null}

            {feeData ? (
              <RevealSection
                onMeasureY={(y) => {
                  sectionY.current.fee = y;
                }}
              >
                {(play) => (
                  <FeePaybackBar
                    annualFee={feeData.annualFee}
                    benefitCount={feeData.benefitCount}
                    play={play}
                  />
                )}
              </RevealSection>
            ) : (
              // Anchor for the fee chip even when there's no payback data.
              <ScrollReveal
                onMeasureY={(y) => {
                  sectionY.current.fee = y;
                }}
              >
                <View />
              </ScrollReveal>
            )}

            {pointsItems.length > 0 || renewal ? (
              <RevealSection
                onMeasureY={(y) => {
                  sectionY.current.stats = y;
                }}
              >
                {(play) => (
                  <TrackStatCards
                    points={pointsItems}
                    renewal={renewal}
                    ledger={cardLedger}
                    play={play}
                  />
                )}
              </RevealSection>
            ) : null}
          </ScrollRevealProvider>
        </Animated.ScrollView>
      ) : null}

      <CardOverflowMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={OVERFLOW_ACTIONS}
        onSelect={onOverflowSelect}
      />

      {card ? (
        <CardholderNameSheet
          visible={nameSheetOpen}
          onClose={() => setNameSheetOpen(false)}
          cardId={card.id}
          userId={userId}
          initialName={card.cardholderName}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 2, minWidth: 0 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.xxl,
    paddingTop: spacing.xs,
  },
  hero: {
    paddingHorizontal: spacing.xl,
    position: 'relative',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
