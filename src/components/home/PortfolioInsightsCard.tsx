/**
 * PortfolioInsightsCard — catalog-derived portfolio fact (lounge / overlaps).
 * No fabricated visit totals or ₹ portfolio value.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { PortfolioInsights } from '@/lib/portfolioInsights';

function formatNameList(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

export function PortfolioInsightsCard({
  insights,
  delay = 0,
}: {
  insights: PortfolioInsights;
  delay?: number;
}) {
  const palette = usePalette();
  const { lounge, overlaps } = insights;

  let headline: string | null = null;
  let support: string | null = null;

  if (lounge && lounge.cardsWithLounge > 0) {
    const n = lounge.cardsWithLounge;
    headline = `${n} card${n === 1 ? '' : 's'} list lounge access`;
    const names = lounge.lines.map((l) => l.cardNickname);
    const list = formatNameList(names);
    support = list
      ? `${list} overlap on domestic lounge visits.`
      : 'Listed lounge benefits across your vault.';
  } else if (overlaps.length > 0) {
    const top = overlaps[0]!;
    headline = `${top.cardNicknames.length} cards list ${top.label}`;
    support = `${formatNameList(top.cardNicknames)} — ${top.hint}`;
  }

  if (!headline) return null;

  return (
    <AnimatedEntrance delay={delay} offsetY={18} style={styles.wrap}>
      <GlassCard strong padding={spacing.xl} style={styles.card} elevation="raised">
        <Eyebrow color={palette.textTertiary}>
          From your cards' listed benefits
        </Eyebrow>
        <AppText variant="title" style={styles.headline}>
          {headline}
        </AppText>
        {support ? (
          <AppText variant="small" color={palette.textSecondary}>
            {support}
          </AppText>
        ) : null}
      </GlassCard>
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xs },
  card: { gap: spacing.sm },
  headline: { marginTop: 2 },
});
