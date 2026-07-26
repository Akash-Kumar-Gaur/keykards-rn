/**
 * Unit tests for clipboard hash + confirm-batch ordinal + dedupe keys.
 */

import { hashClipboardText } from '@/stores/clipboardProcessedStore';
import { dedupeKey, isDuplicateMatch } from '@/lib/transactionDedupeKey';

describe('hashClipboardText', () => {
  it('is stable for identical content', () => {
    const a = hashClipboardText('INR 100 spent on HDFC\n\nRs. 50 spent on SBI');
    const b = hashClipboardText('INR 100 spent on HDFC\n\nRs. 50 spent on SBI');
    expect(a).toBe(b);
  });

  it('normalizes whitespace so minor paste diffs match', () => {
    const a = hashClipboardText('hello   world\n\n');
    const b = hashClipboardText('hello world');
    expect(a).toBe(b);
  });

  it('differs for distinct clipboard pastes', () => {
    const a = hashClipboardText('txn one amount 100');
    const b = hashClipboardText('txn one amount 200');
    expect(a).not.toBe(b);
  });
});

describe('confirm batch ordinal (fixed original size)', () => {
  function displayOrdinal(resolvedCount: number, originalBatchSize: number) {
    return Math.min(resolvedCount + 1, Math.max(originalBatchSize, 1));
  }

  it('shows 1 of 3 → 2 of 3 → 3 of 3 as items resolve', () => {
    const original = 3;
    expect(displayOrdinal(0, original)).toBe(1);
    expect(displayOrdinal(1, original)).toBe(2);
    expect(displayOrdinal(2, original)).toBe(3);
  });

  it('does not shrink Y when resolved grows', () => {
    const original = 3;
    const remainingAfterTwo = 1;
    expect(displayOrdinal(2, original)).toBe(3);
    expect(displayOrdinal(2, remainingAfterTwo)).not.toBe(3);
  });
});

describe('dedupeKey', () => {
  const base = {
    userId: 'u1',
    cardId: 'c1',
    amount: 2499,
    transactionDate: '2026-03-15',
    merchantNormalized: 'SWIGGY',
  };

  it('matches identical inserts', () => {
    expect(isDuplicateMatch(base, { ...base })).toBe(true);
  });

  it('treats merchant case-insensitively', () => {
    expect(
      isDuplicateMatch(base, { ...base, merchantNormalized: 'swiggy' }),
    ).toBe(true);
  });

  it('differs when amount changes', () => {
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, amount: 2500 }));
  });
});
