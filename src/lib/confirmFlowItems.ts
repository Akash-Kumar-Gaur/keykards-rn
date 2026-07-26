/**
 * ConfirmFlowItem — shared draft / pending shape for the confirm bottom sheet.
 * Works for clipboard, OCR, and Gmail pending rows alike.
 */

import type { DuplicateRef } from '@/lib/transactionDedupe';
import type {
  ParsedTransaction,
  SourceConfidence,
  TransactionSource,
  TransactionType,
  VaultTransaction,
} from '@/types/track';

export type ConfirmFlowItem = {
  key: string;
  source: TransactionSource;
  rawText: string;
  amount: number;
  merchantRaw: string;
  merchantNormalized: string | null;
  cardLastFour: string | null;
  transactionDate: string;
  transactionType: TransactionType;
  pointsAmount: number | null;
  expiryDate: string | null;
  sourceConfidence: SourceConfidence;
  suggestedCardId: string | null;
  bankHint: string | null;
  /** Present when already persisted as a pending vault row. */
  vaultId?: string;
  /**
   * Set when this draft looks like an existing transaction. Flagged items are
   * never auto-added or auto-skipped and are excluded from "Confirm all".
   */
  duplicateOf?: DuplicateRef | null;
  /**
   * True when the suggested/selected vault card has needs_refresh — confirm
   * will save as pending_sync rather than attach card_id.
   */
  cardNeedsRefresh?: boolean;
};

export function confirmItemFromParse(args: {
  key: string;
  parse: { parsed: ParsedTransaction; suggestedCardId?: string | null };
  source: TransactionSource;
  rawText: string;
}): ConfirmFlowItem {
  const p = args.parse.parsed;
  return {
    key: args.key,
    source: args.source,
    rawText: args.rawText,
    amount: p.amount,
    merchantRaw: p.merchantRaw,
    merchantNormalized: p.merchantNormalized,
    cardLastFour: p.cardLastFour,
    transactionDate: p.transactionDate,
    transactionType: p.transactionType,
    pointsAmount: p.pointsAmount ?? null,
    expiryDate: p.expiryDate ?? null,
    sourceConfidence: p.sourceConfidence,
    suggestedCardId: args.parse.suggestedCardId ?? null,
    bankHint: p.bankHint ?? null,
    cardNeedsRefresh: false,
  };
}

export function confirmItemFromVaultTxn(txn: VaultTransaction): ConfirmFlowItem {
  return {
    key: txn.id,
    vaultId: txn.id,
    source: txn.source,
    rawText: txn.rawText ?? '',
    amount: txn.amount,
    merchantRaw: txn.merchantRaw,
    merchantNormalized: txn.merchantNormalized,
    cardLastFour: txn.cardHint?.last_four ?? null,
    transactionDate: txn.transactionDate,
    transactionType: txn.transactionType,
    pointsAmount: txn.pointsAmount,
    expiryDate: txn.pointsExpiryDate,
    sourceConfidence: txn.sourceConfidence,
    suggestedCardId: txn.cardId,
    bankHint: txn.cardHint?.bank_name_guess ?? null,
    cardNeedsRefresh: false,
  };
}

export function toParsedTransaction(item: ConfirmFlowItem): ParsedTransaction {
  return {
    amount: item.amount,
    merchantRaw: item.merchantRaw,
    merchantNormalized: item.merchantNormalized,
    cardLastFour: item.cardLastFour,
    transactionDate: item.transactionDate,
    transactionType: item.transactionType,
    pointsAmount: item.pointsAmount,
    expiryDate: item.expiryDate,
    bankHint: item.bankHint,
    sourceConfidence: item.sourceConfidence,
    matchedRuleId: null,
  };
}
