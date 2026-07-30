/**
 * Annual fee totals for Track — only real card.annualFee / feeDueDate values.
 */

import { annualFeesDueSoon, totalAnnualFees } from './trackFees';
import type { VaultCard } from '@/types/card';

function card(partial: Partial<VaultCard> & Pick<VaultCard, 'id'>): VaultCard {
  return {
    id: partial.id,
    userId: 'u1',
    nickname: partial.nickname ?? 'Card',
    bankName: partial.bankName ?? 'Bank',
    network: partial.network ?? 'Visa',
    lastFour: partial.lastFour ?? '1234',
    cardColorTheme: partial.cardColorTheme ?? 'generic-slate',
    annualFee: partial.annualFee ?? null,
    feeDueDate: partial.feeDueDate ?? null,
    renewalDateConfirmed: null,
    renewalDateEstimated: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    cardholderName: null,
    txnLinkBlocked: false,
    ...partial,
  } as VaultCard;
}

describe('totalAnnualFees', () => {
  it('sums only positive fees', () => {
    expect(
      totalAnnualFees([
        card({ id: 'a', annualFee: 5000 }),
        card({ id: 'b', annualFee: 0 }),
        card({ id: 'c', annualFee: null }),
        card({ id: 'd', annualFee: 1500 }),
      ]),
    ).toBe(6500);
  });
});

describe('annualFeesDueSoon', () => {
  it('includes fees due within the window from real feeDueDate', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const soonIso = soon.toISOString().slice(0, 10);
    const far = new Date();
    far.setDate(far.getDate() + 120);
    const farIso = far.toISOString().slice(0, 10);

    expect(
      annualFeesDueSoon([
        card({ id: 'a', annualFee: 6500, feeDueDate: soonIso }),
        card({ id: 'b', annualFee: 9999, feeDueDate: farIso }),
        card({ id: 'c', annualFee: 1000, feeDueDate: null }),
      ]),
    ).toBe(6500);
  });
});
