import {
  acknowledgeDuplicate,
  acknowledgeKey,
  findDuplicateCard,
  isReadyForDuplicateCheck,
  isDuplicateAcknowledged,
  markDuplicatePrompted,
  resetDuplicateAcknowledgements,
  signatureFromForm,
  wasDuplicatePrompted,
} from './duplicateCard';
import type { VaultCard } from '@/types/card';

function card(over: Partial<VaultCard> & { id: string }): VaultCard {
  return {
    userId: 'u1',
    nickname: 'HDFC Regalia',
    bankName: 'HDFC Bank',
    network: 'Visa',
    lastFour: '4821',
    cardholderName: null,
    cardNumberEncrypted: 'x',
    cardNumberIv: 'x',
    cardNumberAuthTag: 'x',
    cvvEncrypted: null,
    cvvIv: null,
    cvvAuthTag: null,
    expiryMonth: 8,
    expiryYear: 2029,
    cardColorTheme: 'midnight',
    annualFee: null,
    feeDueDate: null,
    renewalDateEstimated: null,
    renewalDateConfirmed: null,
    cardOpenedApprox: null,
    txnLinkBlocked: false,
    ...over,
  } as VaultCard;
}

const existing = card({ id: 'c1' });

describe('duplicate readiness (last4 + expiry)', () => {
  it('is ready without a bank name', () => {
    expect(
      isReadyForDuplicateCheck({
        bankName: '',
        lastFour: '4821',
        expiryMonth: 8,
        expiryYear: 2029,
      }),
    ).toBe(true);
  });

  it('is not ready until last four is complete', () => {
    expect(
      isReadyForDuplicateCheck({
        bankName: 'HDFC',
        lastFour: '482',
        expiryMonth: 8,
        expiryYear: 2029,
      }),
    ).toBe(false);
  });

  it('falls back to stored last four when edit leaves number blank', () => {
    const sig = signatureFromForm({
      bankName: 'HDFC Bank',
      cardNumber: '',
      expiryMonth: 8,
      expiryYear: 2029,
      fallbackLastFour: '4821',
    });
    expect(sig.lastFour).toBe('4821');
  });

  it('acknowledgeKey ignores bank so early ack sticks', () => {
    expect(
      acknowledgeKey({
        bankName: '',
        lastFour: '4821',
        expiryMonth: 8,
        expiryYear: 2029,
      }),
    ).toBe(
      acknowledgeKey({
        bankName: 'HDFC Bank',
        lastFour: '4821',
        expiryMonth: 8,
        expiryYear: 2029,
      }),
    );
  });
});

describe('findDuplicateCard', () => {
  const withBank = {
    bankName: 'HDFC Bank',
    lastFour: '4821',
    expiryMonth: 8,
    expiryYear: 2029,
  };

  it('flags a match on last4+expiry alone (early entry, no bank yet)', () => {
    expect(
      findDuplicateCard({
        cards: [existing],
        signature: { ...withBank, bankName: '' },
      })?.id,
    ).toBe('c1');
  });

  it('flags a matching card when bank is also provided', () => {
    expect(findDuplicateCard({ cards: [existing], signature: withBank })?.id).toBe(
      'c1',
    );
  });

  it('does NOT flag a card against itself when editing', () => {
    expect(
      findDuplicateCard({
        cards: [existing],
        signature: withBank,
        excludeCardId: 'c1',
      }),
    ).toBeNull();
  });

  it('flags when an edit collides with a different card', () => {
    const other = card({ id: 'c2', nickname: 'Axis Magnus' });
    expect(
      findDuplicateCard({
        cards: [existing, other],
        signature: withBank,
        excludeCardId: 'c2',
      })?.id,
    ).toBe('c1');
  });

  it('with bank set, ignores cards differing only in bank', () => {
    expect(
      findDuplicateCard({
        cards: [card({ id: 'c5', bankName: 'Axis Bank' })],
        signature: withBank,
      }),
    ).toBeNull();
  });

  it('ignores cards differing in last four or expiry', () => {
    expect(
      findDuplicateCard({
        cards: [card({ id: 'c3', expiryYear: 2030 })],
        signature: withBank,
      }),
    ).toBeNull();
    expect(
      findDuplicateCard({
        cards: [card({ id: 'c4', lastFour: '1234' })],
        signature: withBank,
      }),
    ).toBeNull();
  });
});

describe('session acknowledgement / prompted', () => {
  beforeEach(resetDuplicateAcknowledgements);

  it('remembers an "Add anyway" for the same last4+expiry', () => {
    const sig = {
      bankName: 'HDFC Bank',
      lastFour: '4821',
      expiryMonth: 8,
      expiryYear: 2029,
    };
    expect(isDuplicateAcknowledged(sig)).toBe(false);
    acknowledgeDuplicate(sig);
    expect(isDuplicateAcknowledged(sig)).toBe(true);
    expect(
      isDuplicateAcknowledged({ ...sig, bankName: '' }),
    ).toBe(true);
    expect(
      isDuplicateAcknowledged({ ...sig, lastFour: '9999' }),
    ).toBe(false);
  });

  it('marks prompted so Cancel does not immediately re-warn', () => {
    const sig = {
      bankName: '',
      lastFour: '4821',
      expiryMonth: 8,
      expiryYear: 2029,
    };
    markDuplicatePrompted(sig);
    expect(wasDuplicatePrompted(sig)).toBe(true);
    expect(isDuplicateAcknowledged(sig)).toBe(false);
  });
});
