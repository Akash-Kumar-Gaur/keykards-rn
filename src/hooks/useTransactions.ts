/**
 * Transactions + points ledger CRUD and pending confirm flow.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  autoFinalizeAt,
  rawTextExpiresAt,
  truncateRawForStorage,
} from '@/lib/transactionParser';
import {
  mapPointsLedgerRow,
  mapTransactionRow,
  POINTS_LEDGER_SELECT,
  TRANSACTION_SELECT,
  type PointsLedgerRow,
  type TransactionRow,
} from '@/lib/trackMappers';
import { findDuplicateTransaction } from '@/lib/transactionDedupe';
import { cardHintMatchesCard } from '@/lib/transactionLinking';
import type {
  CardHint,
  ParsedTransaction,
  PointsLedgerEntry,
  SourceConfidence,
  TransactionLinkStatus,
  TransactionSource,
  VaultTransaction,
  CatalogPolicyFields,
} from '@/types/track';

export const trackKeys = {
  all: ['track'] as const,
  txns: (userId: string) => ['track', 'txns', userId] as const,
  pending: (userId: string) => ['track', 'pending', userId] as const,
  attention: (userId: string) => ['track', 'attention', userId] as const,
  points: (userId: string) => ['track', 'points', userId] as const,
  gmail: (userId: string) => ['track', 'gmail', userId] as const,
  snapshot: (userId: string) => ['track', 'snapshot', userId] as const,
};

export function useTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: trackKeys.txns(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<VaultTransaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('user_id', userId!)
        .neq('status', 'dismissed')
        .order('transaction_date', { ascending: false })
        .limit(500);
      if (error) {
        logger.warn('Failed to load transactions', error);
        throw error;
      }
      return (data as TransactionRow[] | null)?.map(mapTransactionRow) ?? [];
    },
    staleTime: 15_000,
  });
}

export function usePendingTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: trackKeys.pending(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<VaultTransaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('user_id', userId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) {
        logger.warn('Failed to load pending transactions', error);
        throw error;
      }
      return (data as TransactionRow[] | null)?.map(mapTransactionRow) ?? [];
    },
    staleTime: 8_000,
  });
}

export function usePointsLedger(userId: string | undefined) {
  return useQuery({
    queryKey: trackKeys.points(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<PointsLedgerEntry[]> => {
      const { data, error } = await supabase
        .from('points_ledger')
        .select(POINTS_LEDGER_SELECT)
        .eq('user_id', userId!)
        .order('earn_date', { ascending: false })
        .limit(300);
      if (error) {
        logger.warn('Failed to load points ledger', error);
        throw error;
      }
      return (data as PointsLedgerRow[] | null)?.map(mapPointsLedgerRow) ?? [];
    },
    staleTime: 20_000,
  });
}

export function useGmailConnection(userId: string | undefined) {
  return useQuery({
    queryKey: trackKeys.gmail(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select(
          'user_id, connected_at, last_sync_at, status, email_address, refresh_token_encrypted',
        )
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) {
        logger.warn('Failed to load gmail connection', error);
        throw error;
      }
      if (!data) return null;
      const row = data as {
        user_id: string;
        connected_at: string;
        last_sync_at: string | null;
        status: string;
        email_address: string | null;
        refresh_token_encrypted: string | null;
      };
      // Never expose the encrypted token to callers — only whether it exists.
      return {
        user_id: row.user_id,
        connected_at: row.connected_at,
        last_sync_at: row.last_sync_at,
        status: row.status,
        email_address: row.email_address,
        hasVerifiedOauth: Boolean(row.refresh_token_encrypted),
      };
    },
    staleTime: 60_000,
  });
}

export type IngestParsedInput = {
  userId: string;
  parsed: ParsedTransaction;
  source: TransactionSource;
  rawText: string;
  cardId: string | null;
  /** Force confidence override after user assignment. */
  confidence?: SourceConfidence;
  /**
   * Set when the user reviewed a "Possible duplicate" flag and chose Add
   * anyway. The pre-insert duplicate check is then skipped so the row is
   * genuinely written instead of silently collapsing into the existing one.
   */
  allowDuplicate?: boolean;
  /**
   * How this row attaches to a card. Confirm sheet always passes an explicit
   * decision so an out-of-sync target still inserts (pending_sync) instead of
   * being dropped.
   */
  linkStatus?: TransactionLinkStatus;
  cardHint?: CardHint | null;
};

export function useIngestParsedTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IngestParsedInput) => {
      const confidence =
        input.confidence ??
        (input.cardId && input.parsed.sourceConfidence === 'high'
          ? 'high'
          : input.parsed.sourceConfidence);

      const requiresConfirm =
        input.source !== 'gmail' || confidence !== 'high';

      // Duplicates are surfaced in the confirm sheet for an explicit call, so
      // this only guards non-interactive paths (e.g. Gmail auto-import). Once
      // the user has chosen "Add anyway" the check is bypassed entirely.
      if (!input.allowDuplicate) {
        const dup = await findDuplicateTransaction({
          userId: input.userId,
          cardId: input.cardId,
          amount: input.parsed.amount,
          transactionDate: input.parsed.transactionDate,
          merchantNormalized: input.parsed.merchantNormalized,
        });
        if (dup) {
          return dup;
        }
      }

      const linkStatus: TransactionLinkStatus =
        input.linkStatus ??
        (input.cardId ? 'linked' : 'unmatched');

      const row = {
        user_id: input.userId,
        card_id: input.cardId,
        amount: input.parsed.amount,
        merchant_raw: input.parsed.merchantRaw,
        merchant_normalized: input.parsed.merchantNormalized,
        transaction_date: input.parsed.transactionDate,
        source: input.source,
        source_confidence: confidence,
        status: 'pending' as const,
        transaction_type: input.parsed.transactionType,
        points_amount: input.parsed.pointsAmount ?? null,
        points_expiry_date: input.parsed.expiryDate ?? null,
        raw_text: truncateRawForStorage(input.rawText),
        raw_text_expires_at: rawTextExpiresAt(30),
        link_status: linkStatus,
        card_hint: input.cardHint ?? null,
        auto_finalize_at:
          input.source === 'gmail' && confidence === 'high' && !requiresConfirm
            ? autoFinalizeAt(24)
            : input.source === 'gmail' && confidence === 'high'
              ? autoFinalizeAt(24)
              : null,
      };

      // Always pending first; clipboard/OCR never auto without confirm.
      // Gmail high gets auto_finalize_at for grace-period finalize.
      if (input.source === 'clipboard' || input.source === 'ocr' || input.source === 'manual') {
        row.auto_finalize_at = null;
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert(row)
        .select(TRANSACTION_SELECT)
        .single();
      if (error) throw error;

      // Points credit → also draft into points_ledger only after confirm;
      // stash points on the pending txn via amount=0 + type; confirm creates ledger.
      return mapTransactionRow(data as TransactionRow);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: trackKeys.pending(vars.userId) });
      qc.invalidateQueries({ queryKey: trackKeys.txns(vars.userId) });
      qc.invalidateQueries({ queryKey: trackKeys.attention(vars.userId) });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(vars.userId) });
    },
  });
}

export function useConfirmTransaction(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      amount?: number;
      merchantRaw?: string;
      cardId?: string | null;
      transactionDate?: string;
      linkStatus?: TransactionLinkStatus;
      cardHint?: CardHint | null;
    }) => {
      const patch: Record<string, unknown> = {
        status: 'confirmed',
        auto_finalize_at: null,
      };
      if (args.amount != null) patch.amount = args.amount;
      if (args.merchantRaw != null) {
        patch.merchant_raw = args.merchantRaw;
        patch.merchant_normalized = args.merchantRaw.trim().slice(0, 80);
      }
      if (args.cardId !== undefined) patch.card_id = args.cardId;
      if (args.transactionDate) patch.transaction_date = args.transactionDate;
      if (args.cardId) patch.source_confidence = 'high';
      if (args.linkStatus) patch.link_status = args.linkStatus;
      if (args.cardHint !== undefined) patch.card_hint = args.cardHint;
      // Infer link_status when caller only set cardId (manual assign / legacy).
      if (!args.linkStatus && args.cardId !== undefined) {
        patch.link_status = args.cardId ? 'linked' : 'unmatched';
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', args.id)
        .select(TRANSACTION_SELECT)
        .single();
      if (error) throw error;
      const txn = mapTransactionRow(data as TransactionRow);

      // Annual fee → confirm renewal date + auto-archive milestone cycles
      if (txn.transactionType === 'annual_fee_debit' && txn.cardId) {
        const { error: cardErr } = await supabase
          .from('cards')
          .update({ renewal_date_confirmed: txn.transactionDate })
          .eq('id', txn.cardId);
        if (cardErr) logger.warn('Failed to set renewal_date_confirmed', cardErr);

        try {
          const { data: cardRow } = await supabase
            .from('cards')
            .select('id, nickname, bank_name, user_id')
            .eq('id', txn.cardId)
            .maybeSingle();
          const bankName = (cardRow as { bank_name?: string } | null)?.bank_name ?? '';
          const nickname =
            (cardRow as { nickname?: string } | null)?.nickname ?? 'Card';
          const ownerId =
            (cardRow as { user_id?: string } | null)?.user_id ?? userId;

          const { data: catalogRows } = await supabase
            .from('card_catalog')
            .select(
              'bank_name, milestone_threshold, milestone_period_months, milestone_reward_description, fee_waiver_spend_threshold, points_expiry_policy_months',
            );

          const rows =
            (catalogRows as
              | {
                  bank_name: string;
                  milestone_threshold: number | string | null;
                  milestone_period_months: number | null;
                  milestone_reward_description: string | null;
                  fee_waiver_spend_threshold: number | string | null;
                  points_expiry_policy_months: number | null;
                }[]
              | null) ?? [];
          const match =
            rows.find((r) => r.bank_name.toLowerCase() === bankName.toLowerCase()) ??
            rows.find((r) =>
              bankName.toLowerCase().includes(r.bank_name.split(' ')[0].toLowerCase()),
            );

          const policy: CatalogPolicyFields | null = match
            ? {
                milestoneThreshold:
                  match.milestone_threshold != null
                    ? Number(match.milestone_threshold)
                    : null,
                milestonePeriodMonths: match.milestone_period_months,
                milestoneRewardDescription: match.milestone_reward_description,
                feeWaiverSpendThreshold:
                  match.fee_waiver_spend_threshold != null
                    ? Number(match.fee_waiver_spend_threshold)
                    : null,
                pointsExpiryPolicyMonths: match.points_expiry_policy_months,
              }
            : null;

          if (ownerId) {
            const { performMilestoneReset, periodMonthsFromPolicy } = await import(
              '@/hooks/useMilestoneReset'
            );
            await performMilestoneReset({
              cardId: txn.cardId,
              cardNickname: nickname,
              userId: ownerId,
              reason: 'auto_renewal',
              periodMonths: periodMonthsFromPolicy(policy),
              policy,
              notify: true,
            });
          }
        } catch (resetErr) {
          logger.warn('Auto milestone reset on renewal failed', resetErr);
        }
      }

      // Points credit → ledger row
      if (
        txn.transactionType === 'points_credit' &&
        txn.cardId &&
        userId &&
        txn.pointsAmount &&
        txn.pointsAmount > 0
      ) {
        const { error: ptsErr } = await supabase.from('points_ledger').insert({
          user_id: userId,
          card_id: txn.cardId,
          points_amount: txn.pointsAmount,
          earn_date: txn.transactionDate,
          expiry_date: txn.pointsExpiryDate,
          expiry_date_source: txn.pointsExpiryDate ? 'parsed_email' : null,
          source: txn.source,
        });
        if (ptsErr) logger.warn('Failed to insert points ledger', ptsErr);
      }

      return txn;
    },
    onSuccess: () => {
      if (!userId) return;
      qc.invalidateQueries({ queryKey: trackKeys.pending(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.txns(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.attention(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.points(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(userId) });
      qc.invalidateQueries({ queryKey: ['cards'] });
      qc.invalidateQueries({ queryKey: ['dashboard', userId] });
    },
  });
}

export function useDismissTransaction(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'dismissed', auto_finalize_at: null, raw_text: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!userId) return;
      qc.invalidateQueries({ queryKey: trackKeys.pending(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.txns(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.attention(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(userId) });
    },
  });
}

/** Auto-finalize high-confidence Gmail pendings past grace period. */
export function useAutoFinalizePending(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) return 0;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'confirmed', auto_finalize_at: null })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .eq('source', 'gmail')
        .eq('source_confidence', 'high')
        .lte('auto_finalize_at', now)
        .select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (n) => {
      if (!userId || n === 0) return;
      qc.invalidateQueries({ queryKey: trackKeys.pending(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.txns(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(userId) });
    },
  });
}

export function useInsertPointsLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      userId: string;
      cardId: string;
      pointsAmount: number;
      earnDate: string;
      expiryDate: string | null;
      expiryDateSource: 'parsed_email' | 'estimated_policy' | null;
      source: TransactionSource;
    }) => {
      const { data, error } = await supabase
        .from('points_ledger')
        .insert({
          user_id: args.userId,
          card_id: args.cardId,
          points_amount: args.pointsAmount,
          earn_date: args.earnDate,
          expiry_date: args.expiryDate,
          expiry_date_source: args.expiryDateSource,
          source: args.source,
        })
        .select(POINTS_LEDGER_SELECT)
        .single();
      if (error) throw error;
      return mapPointsLedgerRow(data as PointsLedgerRow);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: trackKeys.points(vars.userId) });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(vars.userId) });
      qc.invalidateQueries({ queryKey: ['dashboard', vars.userId] });
    },
  });
}

/**
 * Confirmed (or pending) rows that still need a card link — pending_sync after
 * an out-of-sync confirm, or unmatched after the user dismissed auto-link.
 */
export function useAttentionTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: trackKeys.attention(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<VaultTransaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('user_id', userId!)
        .neq('status', 'dismissed')
        .in('link_status', ['pending_sync', 'unmatched'])
        .order('transaction_date', { ascending: false });
      if (error) {
        logger.warn('Failed to load attention transactions', error);
        throw error;
      }
      return ((data as TransactionRow[]) ?? []).map(mapTransactionRow);
    },
    staleTime: 15_000,
  });
}

/** Attach a card to an unresolved txn (manual escape hatch or reconcile confirm). */
export function useLinkTransaction(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      cardId: string | null;
      linkStatus: TransactionLinkStatus;
    }) => {
      const patch: Record<string, unknown> = {
        card_id: args.cardId,
        link_status: args.linkStatus,
      };
      if (args.cardId) patch.source_confidence = 'high';
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', args.id)
        .select(TRANSACTION_SELECT)
        .single();
      if (error) throw error;
      return mapTransactionRow(data as TransactionRow);
    },
    onSuccess: () => {
      if (!userId) return;
      qc.invalidateQueries({ queryKey: trackKeys.attention(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.txns(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.pending(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(userId) });
      qc.invalidateQueries({ queryKey: ['dashboard', userId] });
    },
  });
}

/** Mark card so txn linking stays pending_sync until PAN is re-entered. */
export async function markCardTxnLinkBlocked(cardId: string): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .update({ needs_refresh: true })
    .eq('id', cardId);
  if (error) logger.warn('Failed to mark card txn-link blocked', error);
}

/** Clear txn-link block after a successful re-encrypt. */
export async function clearCardTxnLinkBlocked(cardId: string): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .update({ needs_refresh: false })
    .eq('id', cardId);
  if (error) logger.warn('Failed to clear card txn-link block', error);
}

/** @deprecated Use markCardTxnLinkBlocked */
export const markCardNeedsRefresh = markCardTxnLinkBlocked;
/** @deprecated Use clearCardTxnLinkBlocked */
export const clearCardNeedsRefresh = clearCardTxnLinkBlocked;

/**
 * pending_sync rows whose card_hint matches this card — for the post-sync
 * reconcile carousel. Does not auto-link.
 */
export async function fetchPendingSyncForCard(args: {
  userId: string;
  lastFour: string;
  bankName: string;
}): Promise<VaultTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('user_id', args.userId)
    .eq('link_status', 'pending_sync')
    .neq('status', 'dismissed')
    .order('transaction_date', { ascending: false });
  if (error) {
    logger.warn('Failed to load pending_sync for reconcile', error);
    throw error;
  }
  const rows = ((data as TransactionRow[]) ?? []).map(mapTransactionRow);
  return rows.filter((t) =>
    cardHintMatchesCard(t.cardHint, {
      lastFour: args.lastFour,
      bankName: args.bankName,
    }),
  );
}
