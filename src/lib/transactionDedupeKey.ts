/**
 * Pure helpers for transaction duplicate matching (unit-tested).
 */

export type DedupeKeyParts = {
  userId: string;
  cardId: string | null;
  amount: number;
  transactionDate: string;
  merchantNormalized: string | null;
};

/** Stable key for comparing two candidate inserts. */
export function dedupeKey(parts: DedupeKeyParts): string {
  const merchant = (parts.merchantNormalized ?? '').trim().toLowerCase();
  return [
    parts.userId,
    parts.cardId ?? 'null',
    String(parts.amount),
    parts.transactionDate,
    merchant,
  ].join('|');
}

export function isDuplicateMatch(a: DedupeKeyParts, b: DedupeKeyParts): boolean {
  return dedupeKey(a) === dedupeKey(b);
}
