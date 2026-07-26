/**
 * Aggregated Track snapshot for Track tab + Home dashboard tiles.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  computeFeePayback,
  computeMilestoneProgress,
  computePointsExpiring,
  computeRenewals,
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
import { trackKeys } from '@/hooks/useTransactions';
import type { CatalogPolicyFields, TrackSnapshot } from '@/types/track';

function matchCatalogPolicy(
  rows: CatalogPolicyRow[],
  bankName: string,
  cardName: string,
): CatalogPolicyFields | null {
  return resolveCatalogPolicy({ rows, bankName, cardName });
}

async function fetchTrackSnapshot(userId: string): Promise<TrackSnapshot> {
  const [cardsRes, txnsRes, pointsRes, gmailRes, benefitsRes, milestonesRes, catalogRes] =
    await Promise.all([
      supabase.from('cards').select(CARD_SELECT).eq('user_id', userId),
      supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('user_id', userId)
        .neq('status', 'dismissed'),
      supabase
        .from('points_ledger')
        .select(POINTS_LEDGER_SELECT)
        .eq('user_id', userId),
      supabase
        .from('gmail_connections')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('card_benefits')
        .select('card_id, value_estimate'),
      supabase
        .from('card_milestones')
        .select(
          'card_id, target_spend, current_spend, reward_description, period_start, period_end, cycle_started_at',
        ),
      supabase
        .from('card_catalog')
        .select(
          'bank_name, card_name, milestone_threshold, milestone_period_months, milestone_reward_description, fee_waiver_spend_threshold, points_expiry_policy_months',
        ),
    ]);

  if (cardsRes.error) {
    logger.warn('Track cards failed', cardsRes.error);
    throw cardsRes.error;
  }

  const cards = ((cardsRes.data as CardRow[]) ?? []).map(mapCardRow);
  const txns =
    ((txnsRes.data as TransactionRow[]) ?? []).map(mapTransactionRow);
  const points =
    ((pointsRes.data as PointsLedgerRow[]) ?? []).map(mapPointsLedgerRow);
  const catalog = (catalogRes.data as CatalogPolicyRow[]) ?? [];
  const benefitRows = (benefitsRes.data as { card_id: string; value_estimate: number | string | null }[]) ?? [];
  const milestoneRows =
    (milestonesRes.data as {
      card_id: string;
      target_spend: number | string;
      current_spend: number | string;
      reward_description: string | null;
      period_start?: string;
      period_end?: string;
      cycle_started_at?: string | null;
    }[]) ?? [];

  const pendingCount = txns.filter((t) => t.status === 'pending').length;
  const gmailConnected = gmailRes.data?.status === 'connected';

  const milestones = cards
    .map((c) => {
      const policy = matchCatalogPolicy(catalog, c.bankName, c.nickname);
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
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const feePayback = cards
    .map((c) => {
      const policy = matchCatalogPolicy(catalog, c.bankName, c.nickname);
      const benefitValueSum = benefitRows
        .filter((b) => b.card_id === c.id)
        .reduce((s, b) => s + (Number(b.value_estimate) || 0), 0);
      const periodMonths = policy?.milestonePeriodMonths ?? 12;
      const periodSpend = sumSpendInPeriod(
        txns,
        c.id,
        periodStartForMonths(periodMonths),
      );
      return computeFeePayback({
        cardId: c.id,
        cardNickname: c.nickname,
        bankName: c.bankName,
        annualFee: c.annualFee,
        benefitValueSum,
        waiverThreshold: policy?.feeWaiverSpendThreshold ?? null,
        periodSpend,
      });
    })
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const pointsExpiring = computePointsExpiring({
    entries: points,
    cards: cards.map((c) => ({
      id: c.id,
      nickname: c.nickname,
      bankName: c.bankName,
      policyMonths:
        matchCatalogPolicy(catalog, c.bankName, c.nickname)
          ?.pointsExpiryPolicyMonths ?? null,
    })),
  });

  const renewals = computeRenewals({
    cards: cards.map((c) => ({
      id: c.id,
      nickname: c.nickname,
      bankName: c.bankName,
      renewalDateEstimated: c.renewalDateEstimated,
      renewalDateConfirmed: c.renewalDateConfirmed,
    })),
  });

  return {
    milestones,
    feePayback,
    pointsExpiring,
    renewals,
    pendingCount,
    gmailConnected,
  };
}

export function useTrackSnapshot(userId: string | undefined) {
  return useQuery({
    queryKey: trackKeys.snapshot(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: () => fetchTrackSnapshot(userId!),
    staleTime: 20_000,
  });
}
