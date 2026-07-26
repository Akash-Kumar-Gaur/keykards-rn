/**
 * Detect near-duplicate transactions before insert.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  mapTransactionRow,
  TRANSACTION_SELECT,
  type TransactionRow,
} from '@/lib/trackMappers';
import type { VaultTransaction } from '@/types/track';

export type DuplicateMatchInput = {
  userId: string;
  cardId: string | null;
  amount: number;
  transactionDate: string;
  merchantNormalized: string | null;
};

/** Brief description of the row a draft appears to duplicate. */
export type DuplicateRef = {
  id: string;
  amount: number;
  transactionDate: string;
  merchantRaw: string;
  status: VaultTransaction['status'];
};

export function toDuplicateRef(txn: VaultTransaction): DuplicateRef {
  return {
    id: txn.id,
    amount: txn.amount,
    transactionDate: txn.transactionDate,
    merchantRaw: txn.merchantRaw,
    status: txn.status,
  };
}

function sameMerchant(a: string | null, b: string | null): boolean {
  const left = a?.trim().toLowerCase() ?? '';
  const right = b?.trim().toLowerCase() ?? '';
  // Missing merchant on either side shouldn't block an amount+date+card match.
  if (!left || !right) return true;
  return left === right;
}

/**
 * Match many drafts against existing rows with a single query. Used to flag
 * duplicates in the confirm sheet so the user decides, rather than skipping.
 */
export async function findDuplicatesForDrafts(args: {
  userId: string;
  drafts: {
    key: string;
    cardId: string | null;
    amount: number;
    transactionDate: string;
    merchantNormalized: string | null;
  }[];
}): Promise<Record<string, DuplicateRef>> {
  const { userId, drafts } = args;
  if (drafts.length === 0) return {};

  const dates = Array.from(new Set(drafts.map((d) => d.transactionDate)));
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('user_id', userId)
    .neq('status', 'dismissed')
    .in('transaction_date', dates);

  if (error) {
    logger.warn('Batch duplicate lookup failed', error);
    return {};
  }

  const existing = ((data as TransactionRow[] | null) ?? []).map(mapTransactionRow);
  if (existing.length === 0) return {};

  const out: Record<string, DuplicateRef> = {};
  // Track rows already claimed so two identical drafts in one paste don't both
  // point at the same single existing row.
  const claimed = new Set<string>();

  for (const draft of drafts) {
    const match = existing.find(
      (t) =>
        !claimed.has(t.id) &&
        t.amount === draft.amount &&
        t.transactionDate === draft.transactionDate &&
        (t.cardId ?? null) === (draft.cardId ?? null) &&
        sameMerchant(t.merchantNormalized, draft.merchantNormalized),
    );
    if (match) {
      claimed.add(match.id);
      out[draft.key] = toDuplicateRef(match);
    }
  }

  return out;
}

/**
 * Find an existing non-dismissed row with the same user + amount + date +
 * card (and merchant when available). Used as a safety net against
 * re-importing the same clipboard paste.
 */
export async function findDuplicateTransaction(
  input: DuplicateMatchInput,
): Promise<VaultTransaction | null> {
  let q = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('user_id', input.userId)
    .eq('amount', input.amount)
    .eq('transaction_date', input.transactionDate)
    .neq('status', 'dismissed')
    .limit(5);

  if (input.cardId) {
    q = q.eq('card_id', input.cardId);
  } else {
    q = q.is('card_id', null);
  }

  if (input.merchantNormalized?.trim()) {
    q = q.ilike('merchant_normalized', input.merchantNormalized.trim());
  }

  const { data, error } = await q;
  if (error) {
    logger.warn('Duplicate transaction lookup failed', error);
    return null;
  }
  const rows = (data as TransactionRow[] | null) ?? [];
  if (rows.length === 0) return null;
  // Prefer confirmed, then pending
  const preferred =
    rows.find((r) => r.status === 'confirmed') ??
    rows.find((r) => r.status === 'pending') ??
    rows[0];
  return mapTransactionRow(preferred);
}
