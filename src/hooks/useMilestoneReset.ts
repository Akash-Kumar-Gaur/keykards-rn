/**
 * Reset active milestone cycle(s) for a card — manual or auto-renewal.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { cardKeys } from '@/hooks/useCards';
import { trackKeys } from '@/hooks/useTransactions';
import {
  ensureActiveMilestone,
  resetCardMilestones,
  syncMilestoneSpendBeforeReset,
  type MilestoneClosedReason,
  type MilestoneCycle,
} from '@/lib/milestoneReset';
import { mapMilestoneRow, type MilestoneRow } from '@/lib/cardMappers';
import {
  mapTransactionRow,
  TRANSACTION_SELECT,
  type TransactionRow,
} from '@/lib/trackMappers';
import type { CatalogPolicyFields } from '@/types/track';
import type { CardMilestone } from '@/types/card';
import { useMilestoneResetNoticeStore } from '@/stores/milestoneResetNoticeStore';

export type ResetMilestoneInput = {
  cardId: string;
  cardNickname: string;
  userId: string;
  reason: MilestoneClosedReason;
  periodMonths: number;
  policy: CatalogPolicyFields | null;
  /** When true, push the non-blocking renewal notice. */
  notify?: boolean;
};

export async function performMilestoneReset(
  input: ResetMilestoneInput,
): Promise<MilestoneCycle[]> {
  const { data: milRows, error: milErr } = await supabase
    .from('card_milestones')
    .select('*')
    .eq('card_id', input.cardId);
  if (milErr) throw milErr;

  const existing =
    (milRows as MilestoneRow[] | null)?.map(mapMilestoneRow) ?? [];

  const { data: txnRows, error: txnErr } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('card_id', input.cardId)
    .eq('status', 'confirmed');
  if (txnErr) throw txnErr;
  const txns = ((txnRows as TransactionRow[]) ?? []).map(mapTransactionRow);

  const ensured = await ensureActiveMilestone({
    cardId: input.cardId,
    policy: input.policy,
    existing,
    txns,
  });

  if (ensured.length === 0) {
    return [];
  }

  for (const m of ensured) {
    await syncMilestoneSpendBeforeReset(m, txns);
  }

  const archived = await resetCardMilestones({
    cardId: input.cardId,
    reason: input.reason,
    periodMonths: input.periodMonths,
  });

  if (input.notify && archived.length > 0) {
    useMilestoneResetNoticeStore.getState().push({
      cardId: input.cardId,
      cardNickname: input.cardNickname,
      reason: input.reason === 'auto_renewal' ? 'auto_renewal' : 'manual_reset',
    });
  }

  return archived;
}

export function useResetCardMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: performMilestoneReset,
    onSuccess: (_cycles, vars) => {
      // Milestone numbers are read by three independent caches: Card Detail,
      // the Track snapshot (milestone carousel) and Home's dashboard tiles.
      // refetchType 'all' so the two screens that are mounted-but-inactive
      // refresh now instead of on their next mount.
      const refetchType = 'all' as const;
      qc.invalidateQueries({ queryKey: cardKeys.milestones(vars.cardId), refetchType });
      qc.invalidateQueries({ queryKey: cardKeys.detail(vars.cardId), refetchType });
      qc.invalidateQueries({ queryKey: cardKeys.milestoneCyclesRoot, refetchType });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(vars.userId), refetchType });
      qc.invalidateQueries({ queryKey: ['dashboard', vars.userId], refetchType });
    },
    onError: (err) => {
      logger.warn('Milestone reset failed', err);
    },
  });
}

/** Resolve catalog period months for a card (fallback 12). */
export function periodMonthsFromPolicy(
  policy: CatalogPolicyFields | null,
  milestone?: CardMilestone | null,
): number {
  if (policy?.milestonePeriodMonths && policy.milestonePeriodMonths > 0) {
    return policy.milestonePeriodMonths;
  }
  if (milestone?.periodStart && milestone.periodEnd) {
    const a = new Date(milestone.periodStart + 'T00:00:00Z');
    const b = new Date(milestone.periodEnd + 'T00:00:00Z');
    const months =
      (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
      (b.getUTCMonth() - a.getUTCMonth());
    if (months > 0) return months;
  }
  return 12;
}
