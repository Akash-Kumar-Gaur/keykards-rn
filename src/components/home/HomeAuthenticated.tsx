/**
 * HomeAuthenticated — reference Home layout:
 * header → card carousel → Smart Swipe → stat tiles → portfolio insight.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText } from '@/components/ui/AppText';
import { HomeHeader } from '@/components/home/HomeHeader';
import { SmartSwipeCard } from '@/components/home/SmartSwipeCard';
import { HomeCardsCarousel } from '@/components/home/HomeCardsCarousel';
import { PortfolioInsightsCard } from '@/components/home/PortfolioInsightsCard';
import { HomeStatTiles } from '@/components/home/HomeStatTiles';
import { AddCardsButton } from '@/components/home/AddCardsButton';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { DisplayNameSheet } from '@/components/account/DisplayNameSheet';
import { NameNudgeBanner } from '@/components/account/NameNudgeBanner';
import { spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useCards } from '@/hooks/useCards';
import { useProfile } from '@/hooks/useProfile';
import {
  useCatalogSmartSwipe,
  usePortfolioInsights,
} from '@/hooks/useCatalogFirst';
import { useRequireAuth, AUTH_REASONS } from '@/lib/requireAuth';
import { resolveDisplayName } from '@/lib/displayName';
import {
  isNameNudgeDismissed,
  setNameNudgeDismissed,
} from '@/lib/nameNudge';
import { logger } from '@/lib/logger';

export function HomeAuthenticated() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const requireAuth = useRequireAuth();
  const { data, isLoading, isError } = useDashboardData(user?.id);
  const { data: vaultCards = [], isLoading: cardsLoading } = useCards(user?.id);
  const { data: profile } = useProfile(user?.id);
  const smart = useCatalogSmartSwipe(user?.id);
  const portfolio = usePortfolioInsights(user?.id);

  const displayName = useMemo(
    () => resolveDisplayName(user, profile?.displayName ?? null),
    [user, profile?.displayName],
  );
  const needsName = Boolean(user?.id) && !displayName;

  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || !needsName) {
        if (!cancelled) setNudgeVisible(false);
        return;
      }
      try {
        const dismissed = await isNameNudgeDismissed(user.id);
        if (!cancelled) setNudgeVisible(!dismissed);
      } catch (err) {
        logger.warn('Failed to read name nudge flag', err);
        if (!cancelled) setNudgeVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, needsName]);

  const dismissNudge = useCallback(async () => {
    setNudgeVisible(false);
    if (!user?.id) return;
    try {
      await setNameNudgeDismissed(user.id);
    } catch (err) {
      logger.warn('Failed to persist name nudge dismiss', err);
    }
  }, [user?.id]);

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
  const cardCount = data?.cardCount ?? vaultCards.length;
  const annualFeesLabel = data?.annualFees?.value ?? '₹0';

  const recommendedThemeId = useMemo(() => {
    const id = smart.recommendation?.cardId;
    if (!id) return null;
    return vaultCards.find((c) => c.id === id)?.cardColorTheme ?? null;
  }, [smart.recommendation?.cardId, vaultCards]);

  const carouselDelay = motion.staggerStep;
  const smartDelay = carouselDelay + 280;
  const statsDelay = smartDelay + 220;
  const insightDelay = statsDelay + 200;

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

        {nudgeVisible && needsName ? (
          <NameNudgeBanner
            onAddName={() => setNameSheetOpen(true)}
            onDismiss={() => void dismissNudge()}
          />
        ) : null}

        {isLoading || smart.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.indigo} />
          </View>
        ) : null}

        {isError ? (
          <AppText variant="small" color={palette.amber} style={styles.error}>
            Could not load dashboard data. Try again after adding cards.
          </AppText>
        ) : null}

        <HomeCardsCarousel
          cards={vaultCards}
          loading={cardsLoading && vaultCards.length === 0}
          delay={carouselDelay}
          onSelectCard={goCardDetail}
          onAddCard={goAddCard}
        />

        <SmartSwipeCard
          recommendation={smart.recommendation}
          category={smart.category}
          categories={smart.categories}
          onSelectCategory={smart.setCategory}
          onOpenCard={
            smart.recommendation
              ? () => goCardDetail(smart.recommendation!.cardId)
              : undefined
          }
          onAddCard={hasCards ? goAddCard : undefined}
          hasCards={hasCards}
          cardCount={cardCount}
          themeId={recommendedThemeId}
          delay={smartDelay}
        />

        {hasCards ? (
          <HomeStatTiles
            cardCount={cardCount}
            annualFeesLabel={annualFeesLabel}
            delay={statsDelay}
          />
        ) : null}

        {portfolio.insights ? (
          <PortfolioInsightsCard
            insights={portfolio.insights}
            delay={insightDelay}
          />
        ) : null}

        {/* Single primary Add CTA when vault is empty; hidden once cards exist. */}
        {!hasCards ? (
          <AnimatedEntrance delay={insightDelay + 120} style={styles.cta}>
            <AddCardsButton onPress={goAddCard} />
          </AnimatedEntrance>
        ) : null}
      </ScrollView>

      <DisplayNameSheet
        visible={nameSheetOpen}
        onClose={() => setNameSheetOpen(false)}
        userId={user?.id}
        initialName={displayName}
      />
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
  cta: { marginTop: spacing.lg },
});
