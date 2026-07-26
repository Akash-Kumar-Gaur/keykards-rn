/**
 * Authenticated dashboard data from Supabase + Track derived views.
 *
 * Returns real rows only. With no cards / no track signal, sections stay null
 * so HomeAuthenticated renders empty states — never fabricated numbers.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { DashboardData, emptyDashboard, CardSummary } from '@/types/dashboard';
import { formatInr } from '@/lib/cardUtils';
import {
  computeMilestoneProgress,
  computePointsExpiring,
  periodStartForMonths,
  sumSpendInPeriod,
} from '@/lib/trackDerived';
import {
  mapPointsLedgerRow,
  mapTransactionRow,
  POINTS_LEDGER_SELECT,
  TRANSACTION_SELECT,
  type PointsLedgerRow,
  type TransactionRow,
} from '@/lib/trackMappers';
import { CARD_SELECT, mapCardRow, type CardRow } from '@/lib/cardMappers';
import {
  resolveCatalogPolicy,
  type CatalogPolicyRow,
} from '@/lib/catalogPolicy';
import { countRecentConfirmedTxns } from '@/lib/smartSwipeEligibility';

async function fetchDashboard(userId: string): Promise<DashboardData> {
  const [cardsRes, txnsRes, pointsRes, catalogRes, milestonesRes] = await Promise.all([
    supabase
      .from('cards')
      .select(CARD_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('user_id', userId)
      .eq('status', 'confirmed'),
    supabase
      .from('points_ledger')
      .select(POINTS_LEDGER_SELECT)
      .eq('user_id', userId),
    supabase
      .from('card_catalog')
      .select(
        'bank_name, card_name, milestone_threshold, milestone_period_months, milestone_reward_description, fee_waiver_spend_threshold, points_expiry_policy_months',
      ),
    supabase
      .from('card_milestones')
      .select(
        'card_id, target_spend, current_spend, reward_description, period_start, cycle_started_at',
      ),
  ]);

  if (cardsRes.error) {
    logger.warn('Dashboard cards query failed; showing empty state', cardsRes.error);
    return emptyDashboard();
  }

  const cardsMapped = ((cardsRes.data as CardRow[]) ?? []).map(mapCardRow);
  const cards: CardSummary[] = cardsMapped.map((row) => ({
    id: row.id,
    displayName: row.nickname,
    createdAt: row.createdAt,
  }));

  const fees = cardsMapped
    .map((r) => r.annualFee)
    .filter((n): n is number => n != null && n > 0);
  const annualFees =
    fees.length > 0
      ? {
          label: 'Annual fees',
          value: formatInr(fees.reduce((a, b) => a + b, 0)),
          subLabel: `${fees.length} card${fees.length === 1 ? '' : 's'}`,
        }
      : null;

  const txns = ((txnsRes.data as TransactionRow[]) ?? []).map(mapTransactionRow);
  const points = ((pointsRes.data as PointsLedgerRow[]) ?? []).map(mapPointsLedgerRow);
  const catalog = (catalogRes.data as CatalogPolicyRow[]) ?? [];
  const milestoneRows =
    (milestonesRes.data as {
      card_id: string;
      target_spend: number | string;
      current_spend: number | string;
      reward_description: string | null;
      period_start?: string;
      cycle_started_at?: string | null;
    }[]) ?? [];

  const pickPolicy = (bankName: string, cardName: string) =>
    resolveCatalogPolicy({ rows: catalog, bankName, cardName });

  const milestoneCandidates = cardsMapped
    .map((c) => {
      const policy = pickPolicy(c.bankName, c.nickname);
      const manual = milestoneRows.find((m) => m.card_id === c.id);
      return computeMilestoneProgress({
        cardId: c.id,
        cardNickname: c.nickname,
        bankName: c.bankName,
        policy,
        manual: manual
          ? {
              target: Number(manual.target_spend) || 0,
              current: Number(manual.current_spend) || 0,
              reward: manual.reward_description ?? '',
              periodStart: manual.period_start,
              cycleStartedAt: manual.cycle_started_at ?? null,
              periodMonths: policy?.milestonePeriodMonths ?? undefined,
            }
          : null,
        txns,
      });
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    // Only surface a milestone once there is real spend behind it; a catalog
    // programme at zero is not progress worth a hero tile.
    .filter((m) => m.spent > 0)
    .sort((a, b) => b.progress - a.progress);

  const top = milestoneCandidates[0];
  const milestone = top
    ? {
        title: top.cardNickname,
        current: formatInr(top.spent),
        target: formatInr(top.threshold),
        progress: top.progress,
        helperText:
          top.remaining > 0
            ? `${formatInr(top.remaining)} more unlocks ${top.rewardDescription}`
            : `Unlocked ${top.rewardDescription}`,
      }
    : null;

  const expiringItems = computePointsExpiring({
    entries: points,
    cards: cardsMapped.map((c) => ({
      id: c.id,
      nickname: c.nickname,
      bankName: c.bankName,
      policyMonths:
        pickPolicy(c.bankName, c.nickname)?.pointsExpiryPolicyMonths ?? null,
    })),
  });
  const soon = expiringItems[0];
  const expiring = soon
    ? {
        label: 'Expiring soon',
        value: `${soon.pointsAmount.toLocaleString()} pts`,
        subLabel: soon.isEstimated
          ? `Est. ${soon.expiryDate}`
          : `${soon.daysUntil}d · ${soon.cardNickname}`,
      }
    : null;

  // Silence unused helper in case spend wiring expands later
  void sumSpendInPeriod;
  void periodStartForMonths;

  const recentConfirmedTxnCount = countRecentConfirmedTxns(txns);

  return {
    ...emptyDashboard(),
    cards,
    cardCount: cards.length,
    recentConfirmedTxnCount,
    annualFees,
    milestone,
    expiring,
  };
}

export function useDashboardData(userId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchDashboard(userId!),
    staleTime: 30_000,
  });
}
