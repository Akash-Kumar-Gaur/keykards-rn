import {
  cardHintMatchesCard,
  resolveLinkDecision,
} from '@/lib/transactionLinking';

describe('resolveLinkDecision', () => {
  const synced = {
    id: 'card-a',
    lastFour: '1234',
    bankName: 'Axis Bank',
    txnLinkBlocked: false,
  };
  const blocked = {
    id: 'card-b',
    lastFour: '5678',
    bankName: 'ICICI Bank',
    txnLinkBlocked: true,
  };

  it('links a ready card with card_id', () => {
    const d = resolveLinkDecision({
      selectedCardId: synced.id,
      selectedCard: synced,
      parseLastFour: '1234',
      parseBankHint: 'Axis',
    });
    expect(d).toEqual({
      cardId: 'card-a',
      linkStatus: 'linked',
      cardHint: { last_four: '1234', bank_name_guess: 'Axis' },
    });
  });

  it('never attaches a txnLinkBlocked card — saves pending_sync with hint', () => {
    const d = resolveLinkDecision({
      selectedCardId: blocked.id,
      selectedCard: blocked,
      parseLastFour: '5678',
      parseBankHint: 'ICICI',
    });
    expect(d.cardId).toBeNull();
    expect(d.linkStatus).toBe('pending_sync');
    expect(d.cardHint).toEqual({
      last_four: '5678',
      bank_name_guess: 'ICICI Bank',
    });
  });

  it('keeps pending_sync when no card but parse hints exist', () => {
    const d = resolveLinkDecision({
      selectedCardId: null,
      selectedCard: null,
      parseLastFour: '9999',
      parseBankHint: 'HDFC',
    });
    expect(d).toEqual({
      cardId: null,
      linkStatus: 'pending_sync',
      cardHint: { last_four: '9999', bank_name_guess: 'HDFC' },
    });
  });

  it('marks unmatched when nothing to reconcile against', () => {
    const d = resolveLinkDecision({
      selectedCardId: null,
      selectedCard: null,
    });
    expect(d).toEqual({
      cardId: null,
      linkStatus: 'unmatched',
      cardHint: null,
    });
  });
});

describe('cardHintMatchesCard', () => {
  it('matches on last_four', () => {
    expect(
      cardHintMatchesCard(
        { last_four: '1234', bank_name_guess: 'Other' },
        { lastFour: '1234', bankName: 'Axis Bank' },
      ),
    ).toBe(true);
  });

  it('matches on bank first word when last_four missing', () => {
    expect(
      cardHintMatchesCard(
        { bank_name_guess: 'Axis' },
        { lastFour: '0000', bankName: 'Axis Bank' },
      ),
    ).toBe(true);
  });

  it('does not match unrelated hints', () => {
    expect(
      cardHintMatchesCard(
        { last_four: '1111', bank_name_guess: 'HDFC' },
        { lastFour: '1234', bankName: 'Axis Bank' },
      ),
    ).toBe(false);
  });
});
