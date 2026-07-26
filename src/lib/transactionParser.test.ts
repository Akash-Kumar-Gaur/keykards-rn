/**
 * Unit tests for the shared transaction parser (HDFC / SBI / Axis / ICICI).
 */

import {
  looksLikeTransaction,
  parseAllTransactions,
  parseTransactionText,
  splitIntoTransactionSegments,
} from './transactionParser';

describe('looksLikeTransaction', () => {
  it('accepts typical bank alert shape', () => {
    expect(
      looksLikeTransaction(
        'INR 1,250.00 spent on HDFC Bank Card XX4821 at AMAZON on 12/03/2026',
      ),
    ).toBe(true);
  });

  it('rejects short unrelated clipboard', () => {
    expect(looksLikeTransaction('hello world')).toBe(false);
  });
});

describe('parseTransactionText', () => {
  const cards = [
    { id: 'c1', lastFour: '4821', bankName: 'HDFC Bank' },
    { id: 'c2', lastFour: '9910', bankName: 'SBI Card' },
  ];

  it('parses HDFC debit with high confidence when last-four matches', () => {
    const r = parseTransactionText(
      'INR 2,499.00 spent on HDFC Bank Card XX4821 at SWIGGY on 15/03/2026. Not you? Call 1800.',
      { cards },
    );
    expect(r.parsed).not.toBeNull();
    expect(r.parsed!.amount).toBe(2499);
    expect(r.parsed!.cardLastFour).toBe('4821');
    expect(r.parsed!.transactionType).toBe('debit');
    expect(r.parsed!.sourceConfidence).toBe('high');
    expect(r.suggestedCardId).toBe('c1');
    expect(r.parsed!.merchantRaw.toLowerCase()).toContain('swiggy');
  });

  it('parses HDFC annual fee debit', () => {
    const r = parseTransactionText(
      'INR 5,000.00 debited towards annual membership fee on HDFC Card XX4821 on 01/04/2026',
      { cards },
    );
    expect(r.parsed!.transactionType).toBe('annual_fee_debit');
    expect(r.parsed!.amount).toBe(5000);
  });

  it('parses SBI Card debit', () => {
    const r = parseTransactionText(
      'Rs. 899 spent on SBI Card XX9910 at BIGBASKET on 10-02-2026',
      { cards },
    );
    expect(r.parsed!.amount).toBe(899);
    expect(r.suggestedCardId).toBe('c2');
    expect(r.parsed!.bankHint).toBe('SBI Card');
  });

  it('parses Axis Bank debit', () => {
    const r = parseTransactionText(
      'INR 1,100 has been spent on Axis Bank Card XX1234 at ZOMATO on 05/01/2026',
      { cards: [{ id: 'c3', lastFour: '1234', bankName: 'Axis Bank' }] },
    );
    expect(r.parsed!.amount).toBe(1100);
    expect(r.parsed!.sourceConfidence).toBe('high');
  });

  it('parses ICICI debit', () => {
    const r = parseTransactionText(
      'INR 450 spent on ICICI Bank Card XX7777 at UBER on 20/03/2026',
      { cards: [{ id: 'c4', lastFour: '7777', bankName: 'ICICI Bank' }] },
    );
    expect(r.parsed!.amount).toBe(450);
    expect(r.parsed!.bankHint).toBe('ICICI Bank');
  });

  it('parses HDFC points credit', () => {
    const r = parseTransactionText(
      '500 reward points have been credited to your HDFC Card XX4821. Points expire on 31/12/2027.',
      { cards },
    );
    expect(r.parsed!.transactionType).toBe('points_credit');
    expect(r.parsed!.pointsAmount).toBe(500);
    expect(r.parsed!.expiryDate).toBe('2027-12-31');
  });

  it('returns medium/low when last-four unmatched (may still bank-hint suggest)', () => {
    const r = parseTransactionText(
      'INR 100 spent on HDFC Bank Card XX0000 at TEST on 01/01/2026',
      { cards },
    );
    expect(r.parsed).not.toBeNull();
    expect(r.parsed!.sourceConfidence).not.toBe('high');
    expect(r.parsed!.cardLastFour).toBe('0000');
  });
});

describe('multi-transaction clipboard split', () => {
  const cards = [
    { id: 'c1', lastFour: '4821', bankName: 'HDFC Bank' },
    { id: 'c2', lastFour: '9910', bankName: 'SBI Card' },
    { id: 'c3', lastFour: '1234', bankName: 'Axis Bank' },
  ];

  const snippetHdfc =
    'INR 2,499.00 spent on HDFC Bank Card XX4821 at SWIGGY on 15/03/2026. Not you? Call 1800.';
  const snippetSbi =
    'Rs. 899 spent on SBI Card XX9910 at BIGBASKET on 10-02-2026';
  const snippetAxis =
    'INR 1,100 has been spent on Axis Bank Card XX1234 at ZOMATO on 05/01/2026';

  it('splits three blank-line-separated snippets', () => {
    const clipboard = [snippetHdfc, snippetSbi, snippetAxis].join('\n\n');
    const segments = splitIntoTransactionSegments(clipboard);
    expect(segments).toHaveLength(3);
  });

  it('splits three concatenated snippets without blank lines', () => {
    const clipboard = `${snippetHdfc} ${snippetSbi} ${snippetAxis}`;
    const segments = splitIntoTransactionSegments(clipboard);
    expect(segments.length).toBeGreaterThanOrEqual(3);
  });

  it('parses all 3 mixed-bank snippets independently', () => {
    const clipboard = [snippetHdfc, snippetSbi, snippetAxis].join('\n\n');
    const results = parseAllTransactions(clipboard, { cards });
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.parsed!.amount).sort((a, b) => a - b)).toEqual([
      899, 1100, 2499,
    ]);
    expect(results.map((r) => r.parsed!.cardLastFour).sort()).toEqual([
      '1234',
      '4821',
      '9910',
    ]);
    // Independent confidence — matched cards stay high even if another were ambiguous
    expect(results.every((r) => r.parsed!.sourceConfidence === 'high')).toBe(true);
    expect(results.map((r) => r.suggestedCardId).sort()).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
  });

  it('keeps confidence independent when one segment is unmatched', () => {
    const ambiguous =
      'INR 50 spent on HDFC Bank Card XX0000 at TESTSHOP on 01/01/2026';
    const clipboard = [snippetHdfc, ambiguous, snippetSbi].join('\n\n');
    const results = parseAllTransactions(clipboard, { cards });
    expect(results).toHaveLength(3);
    const byLast = Object.fromEntries(
      results.map((r) => [r.parsed!.cardLastFour, r.parsed!.sourceConfidence]),
    );
    expect(byLast['4821']).toBe('high');
    expect(byLast['9910']).toBe('high');
    expect(byLast['0000']).not.toBe('high');
  });
});
