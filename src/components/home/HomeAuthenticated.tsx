/**
 * HomeAuthenticated — native-app dashboard (not marketing Hero).
 *
 * Hierarchy: compact header → cards/smart swipe → glance pair → milestone
 * (with Track CTA) → coverage pair → add CTA.
 */

import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { HomeHeader } from '@/components/home/HomeHeader';
import { SmartSwipeCard } from '@/components/home/SmartSwipeCard';
import { HomeCardsCarousel } from '@/components/home/HomeCardsCarousel';
import { StatTile } from '@/components/home/StatTile';
import { MilestoneCard } from '@/components/home/MilestoneCard';
import { AddCardsButton } from '@/components/home/AddCardsButton';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useCards } from '@/hooks/useCards';
import { useSmartSwipeEligibility } from '@/hooks/useSmartSwipeEligibility';
import { useRequireAuth, AUTH_REASONS } from '@/lib/requireAuth';

export function HomeAuthenticated() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const requireAuth = useRequireAuth();
  const { data, isLoading, isError } = useDashboardData(user?.id);
  const { data: vaultCards = [], isLoading: cardsLoading } = useCards(user?.id);
  const [smartSwipeOn, setSmartSwipeOn] = useState(true);

  const eligibility = useSmartSwipeEligibility({
    cardCount: data?.cardCount ?? vaultCards.length,
    recentConfirmedTxnCount: data?.recentConfirmedTxnCount ?? 0,
    recommendation: data?.smartSwipe ?? null,
  });

  const goProfile = () => router.push('/(tabs)/profile');
  const goAddCard = () =>
    requireAuth({
      message: AUTH_REASONS.addCard,
      then: () => router.push('/card/new'),
    });
  const goCardDetail = (id: string) =>
    requireAuth({
      message: AUTH_REASONS.cardDetail,
      then: () => router.push(`/card/${id}` as Href),
    });

  const hasCards = (data?.cardCount ?? vaultCards.length) > 0;

  // KeyKards only surfaces real data — sections with nothing behind them are
  // hidden entirely rather than shown as empty/placeholder tiles.
  const expiring = data?.expiring ?? null;
  const annualFees = data?.annualFees ?? null;
  const warranties = data?.warranties ?? null;
  const subscriptions = data?.subscriptions ?? null;
  const milestone = data?.milestone ?? null;

  const showGlance = Boolean(expiring || annualFees);
  const showCoverage = Boolean(warranties || subscriptions);

  const sectionDelay = motion.staggerStep * 4;

  return (
    <View style={styles.root}>
      <GlowBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + 110,
          },
        ]}
      >
        <HomeHeader onAccount={goProfile} />

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.indigo} />
          </View>
        ) : null}

        {isError ? (
          <AppText variant="small" color={palette.amber} style={styles.error}>
            Could not load dashboard data. Try again after adding cards.
          </AppText>
        ) : null}

        {eligibility.showSmartSwipe ? (
          <SmartSwipeCard
            recommendation={data?.smartSwipe ?? null}
            enabled={smartSwipeOn && Boolean(data?.smartSwipe)}
            onToggle={setSmartSwipeOn}
            onGetStarted={goAddCard}
            onAddCard={goAddCard}
            hasCards={hasCards}
            delay={sectionDelay}
          />
        ) : (
          <HomeCardsCarousel
            cards={vaultCards}
            loading={cardsLoading && vaultCards.length === 0}
            delay={sectionDelay}
            onSelectCard={goCardDetail}
            onAddCard={goAddCard}
          />
        )}

        {/* Glance pair — only rendered when there is real data behind it. */}
        {showGlance ? (
          <View style={styles.section}>
            <Eyebrow color={palette.textTertiary} style={styles.sectionLabel}>
              At a glance
            </Eyebrow>
            <View style={styles.pair}>
              {expiring ? (
                <StatTile
                  data={expiring}
                  icon="time-outline"
                  tone="amber"
                  delay={motion.staggerStep * 5}
                />
              ) : null}
              {annualFees ? (
                <StatTile
                  data={annualFees}
                  icon="checkmark-circle-outline"
                  tone="green"
                  delay={motion.staggerStep * 5 + 50}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Milestone — only shown once there is real spend progress. */}
        {milestone ? (
          <AnimatedEntrance
            delay={motion.staggerStep * 6}
            style={styles.milestoneSection}
          >
            <MilestoneCard
              data={milestone}
              footerLabel="Open Track"
              onFooterPress={() => router.push('/(tabs)/track')}
            />
          </AnimatedEntrance>
        ) : null}

        {/* Coverage pair — only rendered when warranties/subscriptions exist. */}
        {showCoverage ? (
          <View style={styles.section}>
            <Eyebrow color={palette.textTertiary} style={styles.sectionLabel}>
              Coverage
            </Eyebrow>
            <View style={styles.pair}>
              {warranties ? (
                <StatTile
                  data={warranties}
                  icon="shield-checkmark-outline"
                  tone="indigo"
                  delay={motion.staggerStep * 7}
                />
              ) : null}
              {subscriptions ? (
                <StatTile
                  data={subscriptions}
                  icon="repeat-outline"
                  tone="indigo"
                  delay={motion.staggerStep * 7 + 50}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        <AnimatedEntrance delay={motion.staggerStep * 8} style={styles.cta}>
          <AddCardsButton onPress={goAddCard} />
        </AnimatedEntrance>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  loading: { alignItems: 'center', paddingVertical: spacing.sm },
  error: { marginBottom: spacing.xs },
  section: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    paddingHorizontal: 2,
  },
  pair: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  milestoneSection: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cta: { marginTop: spacing.lg },
});
