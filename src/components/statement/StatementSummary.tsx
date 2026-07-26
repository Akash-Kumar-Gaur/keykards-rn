/**
 * StatementSummary — spend breakdown shown after PDF processing.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { CountUpText } from '@/components/ui/CountUpText';
import { IconBadge } from '@/components/ui/IconBadge';
import { CategoryRing } from '@/components/statement/CategoryRing';
import { categoryMeta } from '@/components/card/benefitCategoryMeta';
import { formatInr } from '@/lib/cardUtils';
import type { StatementImportRow } from '@/hooks/useStatementUpload';
import type { StatementCategory, StatementLineItem } from '@/lib/statementParse';
import { STATEMENT_CATEGORIES } from '@/lib/statementParse';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Props = {
  data: StatementImportRow;
  spendChangePct: number | null;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso + 'T00:00:00').getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));
}

export function StatementSummary({ data, spendChangePct }: Props) {
  const palette = usePalette();
  const [activeCat, setActiveCat] = useState<StatementCategory | null>(null);

  const segments = useMemo(() => {
    const total = Math.max(1, data.totalSpend);
    return STATEMENT_CATEGORIES.map((cat) => {
      const amount = Number(data.categoryBreakdown?.[cat] ?? 0);
      return {
        cat,
        amount,
        share: amount / total,
        meta: categoryMeta(cat),
      };
    })
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const activeLines: StatementLineItem[] = useMemo(() => {
    if (!activeCat) return [];
    const source =
      data.lineItems?.length > 0
        ? data.lineItems
        : data.notableTransactions;
    return source.filter((n) => n.category === activeCat);
  }, [activeCat, data.lineItems, data.notableTransactions]);

  const changeLabel =
    spendChangePct == null
      ? null
      : `${spendChangePct >= 0 ? '↑' : '↓'}${Math.abs(Math.round(spendChangePct))}% vs last period`;

  const dueIn = daysUntil(data.paymentDueDate);
  const dueSoon = dueIn != null && dueIn >= 0 && dueIn <= 7;

  return (
    <View style={styles.root}>
      <AnimatedEntrance>
        <Eyebrow color={palette.indigo}>Statement summary</Eyebrow>
        <AppText variant="h1" style={styles.title}>
          {formatPeriod(data.periodStart, data.periodEnd)}
        </AppText>
        <AppText variant="small" color={palette.textSecondary}>
          {data.lineItemCount} line items · {data.newTxnCount} new ·{' '}
          {data.matchedTxnCount} matched existing
        </AppText>
      </AnimatedEntrance>

      <AnimatedEntrance delay={motion.staggerStep}>
        <GlassCard style={styles.hero} strong padding={spacing.xl}>
          <AppText variant="caption" color={palette.textTertiary}>
            Total spend
          </AppText>
          <CountUpText
            value={formatInr(data.totalSpend)}
            variant="h1"
            duration={700}
          />
          {changeLabel ? (
            <AppText
              variant="small"
              color={spendChangePct! >= 0 ? palette.amber : palette.green}
            >
              {changeLabel}
            </AppText>
          ) : (
            <AppText variant="caption" color={palette.textTertiary}>
              No prior period to compare yet
            </AppText>
          )}
        </GlassCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={motion.staggerStep * 2}>
        <Eyebrow color={palette.indigo} style={styles.sectionEyebrow}>
          Categories
        </Eyebrow>
        <GlassCard padding={spacing.lg} style={styles.catCard}>
          <View style={styles.catRow}>
            <CategoryRing segments={segments} />
            <View style={styles.catList}>
              {segments.map((s) => (
                <Pressable
                  key={s.cat}
                  onPress={() =>
                    setActiveCat((c) => (c === s.cat ? null : s.cat))
                  }
                  style={[
                    styles.catItem,
                    activeCat === s.cat && { backgroundColor: palette.indigoSoft },
                  ]}
                >
                  <IconBadge icon={s.meta.icon} tone={s.meta.tone} size={28} />
                  <View style={styles.catText}>
                    <AppText variant="small">{s.meta.label}</AppText>
                    <AppText variant="caption" color={palette.textTertiary}>
                      {Math.round(s.share * 100)}% · {formatInr(s.amount)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
              {segments.length === 0 ? (
                <AppText variant="small" color={palette.textTertiary}>
                  No category split available
                </AppText>
              ) : null}
            </View>
          </View>
          {activeCat ? (
            <View style={styles.activeLines}>
              <AppText variant="caption" color={palette.indigo}>
                {categoryMeta(activeCat).label}
              </AppText>
              {activeLines.length === 0 ? (
                <AppText variant="small" color={palette.textTertiary}>
                  No line items in this category.
                </AppText>
              ) : (
                activeLines.slice(0, 8).map((l, i) => (
                  <AppText
                    key={`${l.date}-${l.merchant}-${i}`}
                    variant="small"
                    numberOfLines={1}
                  >
                    {formatInr(l.amount)} · {l.merchant}
                  </AppText>
                ))
              )}
            </View>
          ) : null}
        </GlassCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={motion.staggerStep * 3}>
        <Eyebrow color={palette.indigo} style={styles.sectionEyebrow}>
          Notable transactions
        </Eyebrow>
        <View style={styles.notableWrap}>
          {data.notableTransactions.map((n, i) => {
            const meta = categoryMeta(n.category);
            return (
              <GlassCard
                key={`${n.date}-${n.merchant}-${i}`}
                padding={spacing.md}
                style={styles.notable}
              >
                <IconBadge icon={meta.icon} tone={meta.tone} size={32} />
                <View style={styles.notableText}>
                  <AppText variant="bodyLg" numberOfLines={1}>
                    {n.merchant}
                  </AppText>
                  <AppText variant="caption" color={palette.textTertiary}>
                    {n.date} · {meta.label}
                  </AppText>
                </View>
                <AppText variant="title">{formatInr(n.amount)}</AppText>
              </GlassCard>
            );
          })}
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={motion.staggerStep * 4}>
        <View style={styles.statRow}>
          <GlassCard padding={spacing.md} style={styles.statTile}>
            <IconBadge icon="sparkles-outline" tone="indigo" size={30} />
            <AppText variant="caption" color={palette.textTertiary}>
              Rewards
            </AppText>
            <CountUpText
              value={
                data.rewardPointsEarned != null
                  ? Math.round(data.rewardPointsEarned).toLocaleString('en-IN')
                  : '—'
              }
            />
            <AppText variant="caption" color={palette.textSecondary}>
              {data.rewardPointsSource === 'statement'
                ? 'From statement'
                : 'Estimated'}
            </AppText>
          </GlassCard>
          <GlassCard
            padding={spacing.md}
            style={[styles.statTile, dueSoon && { borderWidth: 1, borderColor: palette.amber }]}
          >
            <IconBadge
              icon="card-outline"
              tone={dueSoon ? 'amber' : 'amber'}
              size={30}
            />
            <AppText variant="caption" color={palette.textTertiary}>
              Amount due
            </AppText>
            <AppText variant="title">
              {data.totalDue != null ? formatInr(data.totalDue) : '—'}
            </AppText>
            <AppText variant="caption" color={palette.textSecondary}>
              {data.minimumDue != null
                ? `Min ${formatInr(data.minimumDue)}`
                : 'Min due not listed'}
            </AppText>
            {data.paymentDueDate ? (
              <AppText
                variant="caption"
                color={dueSoon ? palette.amber : palette.textTertiary}
              >
                {dueSoon
                  ? `Due in ${dueIn}d · ${data.paymentDueDate}`
                  : `Due ${data.paymentDueDate}`}
              </AppText>
            ) : null}
          </GlassCard>
        </View>
      </AnimatedEntrance>
    </View>
  );
}

function formatPeriod(start: string, end: string): string {
  try {
    const a = new Date(start + 'T00:00:00');
    const b = new Date(end + 'T00:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${a.toLocaleDateString('en-IN', opts)} – ${b.toLocaleDateString('en-IN', {
      ...opts,
      year: 'numeric',
    })}`;
  } catch {
    return `${start} – ${end}`;
  }
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  title: { marginTop: spacing.xs },
  hero: { gap: spacing.xs },
  sectionEyebrow: { marginBottom: spacing.xs },
  catCard: { gap: spacing.md },
  catRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  catList: { flex: 1, gap: spacing.sm },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  catText: { flex: 1, gap: 1 },
  activeLines: { gap: spacing.xs, paddingTop: spacing.sm },
  notableWrap: { gap: spacing.sm },
  notable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  notableText: { flex: 1, gap: 2 },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statTile: { flex: 1, gap: spacing.xs },
});
