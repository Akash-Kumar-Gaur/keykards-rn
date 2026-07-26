/**
 * Dev-only hard reset of all activity + derived state.
 *
 * This is deliberately NOT a cycle close: nothing is archived into
 * milestone_cycles. It clears every table and column that accumulates from
 * imports and test resets, so the app should read empty afterwards.
 *
 * Kept on purpose: `cards` and `card_benefits` — those are the card's own
 * details, not activity. Note that benefit `value_estimate` rows still drive
 * the Fee payback bar, which is benefit-vs-fee advisory math and never depends
 * on spend.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { clearProcessedClipboardHash } from '@/stores/clipboardProcessedStore';

export type DevResetCounts = {
  transactionsDeleted: number;
  pointsLedgerDeleted: number;
  milestonesDeleted: number;
  archivedCyclesDeleted: number;
  gmailConnectionsDeleted: number;
  cardDatesCleared: number;
  clipboardHashCleared: boolean;
};

/** Card ids owned by the user — RLS-safe scoping for child-table writes. */
async function ownedCardIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('id')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data as { id: string }[]) ?? []).map((c) => c.id);
}

async function ownedMilestoneIds(cardIds: string[]): Promise<string[]> {
  if (cardIds.length === 0) return [];
  const { data, error } = await supabase
    .from('card_milestones')
    .select('id')
    .in('card_id', cardIds);
  if (error) throw error;
  return ((data as { id: string }[]) ?? []).map((m) => m.id);
}

/**
 * Wipe every trace of imported activity: transactions, points, milestone rows
 * and their archived cycles, the Gmail link, renewal/fee dates stamped onto
 * cards by fee confirmations, and the last-processed clipboard hash.
 */
export async function devClearActivityData(
  userId: string,
): Promise<DevResetCounts> {
  const { data: deletedTxns, error: txnErr } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .select('id');
  if (txnErr) throw txnErr;

  const { data: deletedPoints, error: ptsErr } = await supabase
    .from('points_ledger')
    .delete()
    .eq('user_id', userId)
    .select('id');
  if (ptsErr) throw ptsErr;

  const cardIds = await ownedCardIds(userId);
  const milestoneIds = await ownedMilestoneIds(cardIds);

  // Archived cycles first — they reference card_milestones.
  let archivedCyclesDeleted = 0;
  if (milestoneIds.length > 0) {
    const { data, error } = await supabase
      .from('milestone_cycles')
      .delete()
      .in('milestone_id', milestoneIds)
      .select('id');
    if (error) throw error;
    archivedCyclesDeleted = data?.length ?? 0;
  }

  // Drop the milestone rows outright rather than zeroing them: a stale
  // period_start anchored to a past test reset would silently exclude
  // re-imported spend. The app re-seeds a fresh cycle when it needs one.
  let milestonesDeleted = 0;
  if (cardIds.length > 0) {
    const { data, error } = await supabase
      .from('card_milestones')
      .delete()
      .in('card_id', cardIds)
      .select('id');
    if (error) throw error;
    milestonesDeleted = data?.length ?? 0;
  }

  const { data: deletedGmail, error: gmailErr } = await supabase
    .from('gmail_connections')
    .delete()
    .eq('user_id', userId)
    .select('user_id');
  if (gmailErr) throw gmailErr;

  // Confirming an annual-fee transaction stamps renewal_date_confirmed, which
  // otherwise survives the wipe and keeps the "Renewals" tile populated.
  let cardDatesCleared = 0;
  if (cardIds.length > 0) {
    const { data, error } = await supabase
      .from('cards')
      .update({
        renewal_date_confirmed: null,
        renewal_date_estimated: null,
        fee_due_date: null,
      })
      .eq('user_id', userId)
      .or(
        'renewal_date_confirmed.not.is.null,renewal_date_estimated.not.is.null,fee_due_date.not.is.null',
      )
      .select('id');
    if (error) throw error;
    cardDatesCleared = data?.length ?? 0;
  }

  const clipboardHashCleared = await clearProcessedClipboardHash();

  const counts: DevResetCounts = {
    transactionsDeleted: deletedTxns?.length ?? 0,
    pointsLedgerDeleted: deletedPoints?.length ?? 0,
    milestonesDeleted,
    archivedCyclesDeleted,
    gmailConnectionsDeleted: deletedGmail?.length ?? 0,
    cardDatesCleared,
    clipboardHashCleared,
  };
  logger.info('[dev] Cleared activity data', counts);
  return counts;
}
