/**
 * TrackStatCards — compact points-expiry + renewal stat tiles (Home-style),
 * count-up on scroll into view, each tappable to expand a bottom sheet with the
 * detailed breakdown (points_ledger batches / renewal source).
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconBadge, type BadgeTone } from '@/components/ui/IconBadge';
import { CountUpText } from '@/components/ui/CountUpText';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { PointsExpiryItem, RenewalStatus } from '@/types/track';
import type { PointsLedgerEntry } from '@/types/track';

export function TrackStatCards({
  points,
  renewal,
  ledger,
  play,
}: {
  points: PointsExpiryItem[];
  renewal: RenewalStatus | null;
  ledger: PointsLedgerEntry[];
  play: boolean;
}) {
  const palette = usePalette();
  const [sheet, setSheet] = useState<'points' | 'renewal' | null>(null);

  const totalPoints = points.reduce((sum, p) => sum + p.pointsAmount, 0);
  const nearest = points[0] ?? null;
  const hasPoints = totalPoints > 0 && nearest != null;
  const pointsValue = totalPoints.toLocaleString('en-IN');
  const pointsSub = nearest
    ? nearest.isEstimated
      ? `~${nearest.daysUntil}d (est.)`
      : `${nearest.daysUntil}d left`
    : '';

  const renewalValue = renewal
    ? renewal.daysUntil != null
      ? `${renewal.daysUntil}d`
      : renewal.renewalDate
    : '';
  const renewalSub = renewal
    ? renewal.isConfirmed
      ? 'Confirmed'
      : 'Estimated'
    : '';

  // Nothing real to show — render nothing rather than a placeholder section.
  if (!hasPoints && !renewal) return null;

  return (
    <View style={styles.wrap}>
      <Eyebrow color={palette.indigo} style={styles.heading}>
        Points & renewal
      </Eyebrow>
      <View style={styles.row}>
        {hasPoints ? (
          <StatCard
            icon="time-outline"
            tone="amber"
            label="Points expiring"
            value={pointsValue}
            sub={pointsSub}
            subColor={palette.amber}
            badge={
              nearest?.isEstimated ? (
                <ConfidenceBadge kind="estimated" />
              ) : (
                <ConfidenceBadge kind="confirmed" />
              )
            }
            play={play}
            delay={0}
            onPress={() => {
              Haptics.selectionAsync();
              setSheet('points');
            }}
          />
        ) : null}
        {renewal ? (
          <StatCard
            icon="refresh-outline"
            tone={renewal.isConfirmed ? 'green' : 'indigo'}
            label="Renewal"
            value={renewalValue}
            sub={renewalSub}
            subColor={renewal.isConfirmed ? palette.green : palette.amber}
            badge={
              renewal.isConfirmed ? (
                <ConfidenceBadge kind="confirmed" />
              ) : (
                <ConfidenceBadge kind="estimated" />
              )
            }
            play={play}
            delay={80}
            onPress={() => {
              Haptics.selectionAsync();
              setSheet('renewal');
            }}
          />
        ) : null}
      </View>

      <BottomSheet visible={sheet === 'points'} onClose={() => setSheet(null)}>
        <PointsBreakdown items={points} ledger={ledger} />
      </BottomSheet>
      <BottomSheet visible={sheet === 'renewal'} onClose={() => setSheet(null)}>
        <RenewalBreakdown renewal={renewal} />
      </BottomSheet>
    </View>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  sub,
  subColor,
  badge,
  play,
  delay,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: BadgeTone;
  label: string;
  value: string;
  sub: string;
  subColor: string;
  badge?: React.ReactNode;
  play: boolean;
  delay: number;
  onPress: () => void;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <Animated.View style={[styles.cardWrap, pressStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          press.value = withTiming(0.97, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withSpring(1, motion.springConfig);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}. Tap for details.`}
      >
        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.cardTop}>
            <IconBadge icon={icon} tone={tone} size={34} />
            <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
          </View>
          <View style={styles.cardText}>
            <View style={styles.labelRow}>
              <Eyebrow color={palette.textTertiary}>{label}</Eyebrow>
              {badge}
            </View>
            {play && value !== '—' ? (
              <CountUpText value={value} delay={delay + 80} style={styles.value} />
            ) : (
              <AppText variant="stat" style={styles.value}>
                {value === '—' ? '—' : reduced ? value : '0'}
              </AppText>
            )}
            <AppText variant="small" color={subColor}>
              {sub}
            </AppText>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

function PointsBreakdown({
  items,
  ledger,
}: {
  items: PointsExpiryItem[];
  ledger: PointsLedgerEntry[];
}) {
  const palette = usePalette();
  const batches = ledger.length > 0 ? ledger : null;
  return (
    <View style={styles.sheet}>
      <AppText variant="h2">Points expiry</AppText>
      {batches ? (
        <View style={styles.batchList}>
          {batches.map((b) => (
            <View key={b.id} style={[styles.batchRow, { borderBottomColor: palette.glassBorder }]}>
              <View>
                <AppText variant="body">
                  {b.pointsAmount.toLocaleString('en-IN')} pts
                </AppText>
                <AppText variant="caption" color={palette.textTertiary}>
                  Earned {b.earnDate}
                </AppText>
              </View>
              <View style={styles.batchRight}>
                <AppText variant="small" color={palette.amber}>
                  {b.expiryDate ?? 'No expiry'}
                </AppText>
                <AppText variant="caption" color={palette.textTertiary}>
                  {b.expiryDateSource === 'parsed_email' ? 'Confirmed' : 'Estimated'}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : items.length > 0 ? (
        <View style={styles.batchList}>
          {items.map((it) => (
            <View key={it.id} style={[styles.batchRow, { borderBottomColor: palette.glassBorder }]}>
              <AppText variant="body">
                {it.pointsAmount.toLocaleString('en-IN')} pts
              </AppText>
              <View style={styles.batchRight}>
                <AppText variant="small" color={palette.amber}>
                  {it.expiryDate}
                </AppText>
                <AppText variant="caption" color={palette.textTertiary}>
                  {it.isEstimated ? 'Estimated' : 'Confirmed'}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <AppText variant="body" color={palette.textSecondary}>
          No points tracked as expiring yet. Confirm points-credit transactions in
          Track to see batch-level expiry here.
        </AppText>
      )}
    </View>
  );
}

function RenewalBreakdown({ renewal }: { renewal: RenewalStatus | null }) {
  const palette = usePalette();
  return (
    <View style={styles.sheet}>
      <AppText variant="h2">Renewal</AppText>
      {renewal ? (
        <>
          <View style={styles.renewalRow}>
            <AppText variant="body" color={palette.textSecondary}>
              {renewal.isConfirmed ? 'Confirmed date' : 'Estimated date'}
            </AppText>
            <AppText
              variant="body"
              color={renewal.isConfirmed ? palette.green : palette.amber}
            >
              {renewal.renewalDate}
            </AppText>
          </View>
          {renewal.daysUntil != null ? (
            <View style={styles.renewalRow}>
              <AppText variant="body" color={palette.textSecondary}>
                Days until renewal
              </AppText>
              <AppText variant="body">{renewal.daysUntil} days</AppText>
            </View>
          ) : null}
          <AppText variant="small" color={palette.textTertiary} style={styles.renewalNote}>
            {renewal.isConfirmed
              ? 'Confirmed from a matched annual-fee transaction.'
              : 'Estimated from when you opened this card. It becomes confirmed automatically once an annual-fee debit is matched.'}
          </AppText>
        </>
      ) : (
        <AppText variant="body" color={palette.textSecondary}>
          No renewal date yet. Add an approximate open date when editing this card to
          get an estimate.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  heading: { paddingHorizontal: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl },
  cardWrap: { flex: 1 },
  card: { minHeight: 128, gap: spacing.md, justifyContent: 'space-between' },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardText: { gap: spacing.xs },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  value: { marginTop: 2 },
  sheet: { gap: spacing.lg, paddingBottom: spacing.sm },
  batchList: { gap: spacing.sm },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  batchRight: { alignItems: 'flex-end' },
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  renewalNote: { lineHeight: 20 },
});
