/**
 * Track section panels — milestones, points, fee payback, renewals.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Tag } from '@/components/ui/Tag';
import { formatInr } from '@/lib/cardUtils';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type {
  FeePaybackStatus,
  MilestoneProgress,
  PointsExpiryItem,
  RenewalStatus,
} from '@/types/track';

function SectionHeader({ title, empty }: { title: string; empty?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.sectionHead}>
      <AppText variant="title">{title}</AppText>
      {empty ? (
        <AppText variant="small" color={palette.textTertiary}>
          {empty}
        </AppText>
      ) : null}
    </View>
  );
}

export function MilestoneTrackList({ items }: { items: MilestoneProgress[] }) {
  const palette = usePalette();
  const router = useRouter();
  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <SectionHeader
          title="Milestones in progress"
          empty="Add cards or import spend to see progress."
        />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionHeader title="Milestones in progress" />
      {items.map((m) => (
        <Pressable
          key={m.cardId}
          onPress={() => router.push(`/card/${m.cardId}` as Href)}
        >
          <GlassCard style={styles.item} padding={spacing.lg}>
            <AppText variant="body" numberOfLines={2} ellipsizeMode="tail">
              {m.cardNickname}
            </AppText>
            <AppText
              variant="small"
              color={palette.textSecondary}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {formatInr(m.spent)} of {formatInr(m.threshold)} spent this {m.periodMonths}-mo
              period
              {m.remaining > 0
                ? ` — ${formatInr(m.remaining)} more unlocks ${m.rewardDescription}`
                : ` — unlocked ${m.rewardDescription}`}
            </AppText>
            <ProgressBar progress={m.progress} />
            <AppText variant="caption" color={palette.textTertiary}>
              {m.source === 'catalog_policy'
                ? 'From catalog policy + confirmed spend'
                : 'From manual milestone'}
            </AppText>
          </GlassCard>
        </Pressable>
      ))}
    </View>
  );
}

export function PointsExpiringList({ items }: { items: PointsExpiryItem[] }) {
  const palette = usePalette();
  const router = useRouter();
  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <SectionHeader
          title="Points expiring soon"
          empty="Import a points credit alert or wait for policy estimates."
        />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionHeader title="Points expiring soon" />
      {items.slice(0, 8).map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/card/${p.cardId}` as Href)}
        >
          <GlassCard style={styles.item} padding={spacing.lg}>
            <View style={styles.rowBetween}>
              <AppText variant="body">{p.pointsAmount.toLocaleString()} pts</AppText>
              {p.isEstimated ? (
                <Tag label="Estimated" tint={palette.amberSoft} color={palette.amber} />
              ) : (
                <Tag label="Confirmed" />
              )}
            </View>
            <AppText variant="small" color={palette.textSecondary}>
              {p.cardNickname} · {p.expiryDate}
              {p.daysUntil >= 0 ? ` · ${p.daysUntil}d left` : ' · expired'}
            </AppText>
            <AppText variant="caption" color={palette.textTertiary}>
              {p.label}
            </AppText>
            <AppText variant="caption" color={palette.textTertiary}>
              Tip: compare convert vs redeem options in your bank app before expiry.
            </AppText>
          </GlassCard>
        </Pressable>
      ))}
    </View>
  );
}

export function FeePaybackList({ items }: { items: FeePaybackStatus[] }) {
  const palette = usePalette();
  const router = useRouter();
  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <SectionHeader title="Annual fees" empty="Add annual fees on a card." />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionHeader title="Annual fees" />
      {items.map((f) => (
        <Pressable
          key={f.cardId}
          onPress={() => router.push(`/card/${f.cardId}` as Href)}
        >
          <GlassCard style={styles.item} padding={spacing.lg}>
            <AppText variant="body">{f.cardNickname}</AppText>
            <AppText variant="small" color={palette.textSecondary}>
              Fee {formatInr(f.annualFee)}
            </AppText>
            {f.likelyWaiver ? (
              <Tag
                label="Likely waiver · advisory"
                tint="rgba(52,211,153,0.15)"
                color={palette.green}
              />
            ) : null}
            <AppText variant="caption" color={palette.textTertiary}>
              {f.likelyWaiver
                ? f.advisoryCopy
                : 'Review this card’s listed benefits — we don’t project a rupee recovery.'}
            </AppText>
          </GlassCard>
        </Pressable>
      ))}
    </View>
  );
}

export function RenewalsList({ items }: { items: RenewalStatus[] }) {
  const palette = usePalette();
  const router = useRouter();
  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <SectionHeader
          title="Upcoming renewals"
          empty="Set “opened approx” on Add Card, or confirm via annual-fee debit."
        />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionHeader title="Upcoming renewals" />
      {items.map((r) => (
        <Pressable
          key={r.cardId}
          onPress={() => router.push(`/card/${r.cardId}` as Href)}
        >
          <GlassCard style={styles.item} padding={spacing.lg}>
            <View style={styles.rowBetween}>
              <AppText variant="body">{r.cardNickname}</AppText>
              {r.isConfirmed ? (
                <Tag label="Confirmed" />
              ) : (
                <Tag label="Estimated" tint={palette.amberSoft} color={palette.amber} />
              )}
            </View>
            <AppText variant="small" color={palette.textSecondary}>
              {r.renewalDate}
              {r.daysUntil != null
                ? r.daysUntil >= 0
                  ? ` · in ${r.daysUntil} days`
                  : ` · ${Math.abs(r.daysUntil)} days ago`
                : ''}
            </AppText>
          </GlassCard>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionHead: { gap: 4, marginBottom: spacing.xs },
  item: { gap: spacing.sm, marginBottom: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
