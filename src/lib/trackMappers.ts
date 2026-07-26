/**
 * Map Track Supabase rows ↔ domain types.
 */

import type {
  CardHint,
  ExpiryDateSource,
  PointsLedgerEntry,
  SourceConfidence,
  TransactionLinkStatus,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  VaultTransaction,
} from '@/types/track';

export type TransactionRow = {
  id: string;
  user_id: string;
  card_id: string | null;
  amount: number | string;
  merchant_raw: string;
  merchant_normalized: string | null;
  transaction_date: string;
  source: string;
  source_confidence: string;
  status: string;
  transaction_type: string;
  points_amount: number | null;
  points_expiry_date: string | null;
  raw_text: string | null;
  raw_text_expires_at: string | null;
  auto_finalize_at: string | null;
  link_status?: string | null;
  card_hint?: CardHint | null;
  category?: string | null;
  created_at: string;
  updated_at: string;
};

export type PointsLedgerRow = {
  id: string;
  user_id: string;
  card_id: string;
  points_amount: number;
  earn_date: string;
  expiry_date: string | null;
  expiry_date_source: string | null;
  source: string;
  created_at: string;
};

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function mapTransactionRow(row: TransactionRow): VaultTransaction {
  const hint = row.card_hint ?? null;
  return {
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id,
    amount: num(row.amount),
    merchantRaw: row.merchant_raw ?? '',
    merchantNormalized: row.merchant_normalized,
    transactionDate: row.transaction_date,
    source: row.source as TransactionSource,
    sourceConfidence: row.source_confidence as SourceConfidence,
    status: row.status as TransactionStatus,
    transactionType: row.transaction_type as TransactionType,
    pointsAmount: row.points_amount,
    pointsExpiryDate: row.points_expiry_date,
    rawText: row.raw_text,
    rawTextExpiresAt: row.raw_text_expires_at,
    autoFinalizeAt: row.auto_finalize_at,
    linkStatus: (row.link_status as TransactionLinkStatus) ??
      (row.card_id ? 'linked' : 'unmatched'),
    cardHint: hint,
    category: row.category ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPointsLedgerRow(row: PointsLedgerRow): PointsLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id,
    pointsAmount: row.points_amount,
    earnDate: row.earn_date,
    expiryDate: row.expiry_date,
    expiryDateSource: row.expiry_date_source as ExpiryDateSource | null,
    source: row.source as TransactionSource,
    createdAt: row.created_at,
  };
}

export const TRANSACTION_SELECT =
  'id, user_id, card_id, amount, merchant_raw, merchant_normalized, transaction_date, source, source_confidence, status, transaction_type, points_amount, points_expiry_date, raw_text, raw_text_expires_at, auto_finalize_at, link_status, card_hint, category, created_at, updated_at';

export const POINTS_LEDGER_SELECT =
  'id, user_id, card_id, points_amount, earn_date, expiry_date, expiry_date_source, source, created_at';
