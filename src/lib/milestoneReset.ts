/**
 * Milestone cycle reset — archive active period, open a fresh cycle.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  addMonthsToIsoDate,
  periodStartForMonths,
  sumSpendInPeriod,
  todayIsoUtc,
} from '@/lib/trackDerived';
import type { CatalogPolicyFields, VaultTransaction } from '@/types/track';
import type { CardMilestone } from '@/types/card';
import { mapMilestoneRow, type MilestoneRow } from '@/lib/cardMappers';

export type MilestoneClosedReason =
  | 'auto_renewal'
  | 'manual_reset'
  | 'period_expired';

export type MilestoneCycle = {
  id: string;
  milestoneId: string;
  periodStart: string;
  periodEnd: string;
  finalSpend: number;
  targetSpend: number;
  wasAchieved: boolean;
  closedReason: MilestoneClosedReason;
  closedAt: string;
};

export type MilestoneCycleRow = {
  id: string;
  milestone_id: string;
  period_start: string;
  period_end: string;
  final_spend: number | string;
  target_spend: number | string;
  was_achieved: boolean;
  closed_reason: MilestoneClosedReason;
  closed_at: string;
};

export function mapMilestoneCycleRow(row: MilestoneCycleRow): MilestoneCycle {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    finalSpend: Number(row.final_spend) || 0,
    targetSpend: Number(row.target_spend) || 0,
    wasAchieved: Boolean(row.was_achieved),
    closedReason: row.closed_reason,
    closedAt: row.closed_at,
  };
}

/**
 * Ensure a card_milestones row exists so reset can archive real progress.
 * Seeds current_spend from confirmed debits in the rolling catalog window.
 */
export async function ensureActiveMilestone(args: {
  cardId: string;
  policy: CatalogPolicyFields | null;
  existing: CardMilestone[];
  txns: VaultTransaction[];
}): Promise<CardMilestone[]> {
  const { cardId, policy, existing, txns } = args;
  if (existing.length > 0) return existing;
  if (!policy?.milestoneThreshold || !policy.milestonePeriodMonths) {
    return existing;
  }

  const periodMonths = policy.milestonePeriodMonths;
  const periodStart = periodStartForMonths(periodMonths);
  const periodEnd = addMonthsToIsoDate(periodStart, periodMonths);
  const currentSpend = sumSpendInPeriod(txns, cardId, periodStart);

  const { data, error } = await supabase
    .from('card_milestones')
    .insert({
      card_id: cardId,
      target_spend: policy.milestoneThreshold,
      current_spend: currentSpend,
      reward_description:
        policy.milestoneRewardDescription?.trim() || 'Milestone reward',
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select('*')
    .single();

  if (error) {
    logger.warn('Failed to seed card_milestones for reset', error);
    throw error;
  }
  return [mapMilestoneRow(data as MilestoneRow)];
}

/** Sync stored current_spend to live txn sum before archive (accurate history). */
export async function syncMilestoneSpendBeforeReset(
  milestone: CardMilestone,
  txns: VaultTransaction[],
): Promise<number> {
  const spent = sumSpendInPeriod(
    txns,
    milestone.cardId,
    milestone.periodStart,
    milestone.cycleStartedAt,
  );
  // Prefer the higher of stored vs txn sum so manual edits aren't lost silently
  // when both exist; after catalog seed they should match.
  const finalSpend = Math.max(spent, milestone.currentSpend);
  if (finalSpend === milestone.currentSpend) return finalSpend;

  const { error } = await supabase
    .from('card_milestones')
    .update({ current_spend: finalSpend })
    .eq('id', milestone.id);
  if (error) {
    logger.warn('Failed to sync milestone spend before reset', error);
    // Still proceed with whatever is stored
    return milestone.currentSpend;
  }
  return finalSpend;
}

export async function resetCardMilestones(args: {
  cardId: string;
  reason: MilestoneClosedReason;
  periodMonths: number;
}): Promise<MilestoneCycle[]> {
  const { data, error } = await supabase.rpc('reset_card_milestones', {
    p_card_id: args.cardId,
    p_closed_reason: args.reason,
    p_period_months: Math.max(1, args.periodMonths),
  });
  if (error) {
    logger.warn('reset_card_milestones RPC failed', error);
    throw error;
  }
  return ((data as MilestoneCycleRow[]) ?? []).map(mapMilestoneCycleRow);
}

export function nextCycleDates(periodMonths: number, today = new Date()) {
  const periodStart = todayIsoUtc(today);
  return {
    periodStart,
    periodEnd: addMonthsToIsoDate(periodStart, Math.max(1, periodMonths)),
  };
}
