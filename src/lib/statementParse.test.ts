/**
 * Statement parse + merge unit tests (no Anthropic / PDF runtime).
 */

import {
  parseStatementLlmJson,
  type StatementLineItem,
} from './statementParse';
import {
  buildCategoryBreakdown,
  estimateRewardPoints,
  findStatementOverlap,
  pickNotableTransactions,
  planStatementMerge,
} from './statementMerge';
import type { VaultTransaction } from '@/types/track';

const SAMPLE_MODEL_JSON = `{
  "statement_period_start": "2026-06-01",
  "statement_period_end": "2026-06-30",
  "total_spend": 84250.5,
  "minimum_due": 4200,
  "total_due": 84250.5,
  "payment_due_date": "2026-07-18",
  "reward_points_earned": 1250,
  "line_items": [
    {"date":"2026-06-03","merchant":"AMAZON PAY INDIA","amount":12999,"category":"shopping"},
    {"date":"2026-06-05","merchant":"SWIGGY","amount":890,"category":"dining"},
    {"date":"2026-06-08","merchant":"INDIAN OIL","amount":3500,"category":"fuel"},
    {"date":"2026-06-12","merchant":"MAKE MY TRIP","amount":24500,"category":"travel"},
    {"date":"2026-06-15","merchant":"BOOKMYSHOW","amount":1200,"category":"entertainment"},
    {"date":"2026-06-20","merchant":"BLR T2 LOUNGE","amount":0,"category":"lounge"},
    {"date":"2026-06-22","merchant":"FLIPKART","amount":8999.5,"category":"shopping"},
    {"date":"2026-06-28","merchant":"ZOMATO","amount":642,"category":"dining"},
    {"date":"bad-date","merchant":"SKIP ME","amount":100,"category":"other"},
    {"date":"2026-06-29","merchant":"","amount":50,"category":"other"}
  ]
}`;

/** Ground-truth expected from the fixture after defensive parse. */
const EXPECTED_MERCHANTS = [
  'AMAZON PAY INDIA',
  'SWIGGY',
  'INDIAN OIL',
  'MAKE MY TRIP',
  'BOOKMYSHOW',
  'FLIPKART',
  'ZOMATO',
];

function txn(partial: Partial<VaultTransaction> & { id: string }): VaultTransaction {
  return {
    userId: 'u1',
    cardId: 'c1',
    amount: 0,
    merchantRaw: 'x',
    merchantNormalized: 'x',
    transactionDate: '2026-06-01',
    source: 'clipboard',
    sourceConfidence: 'high',
    status: 'confirmed',
    transactionType: 'debit',
    pointsAmount: null,
    pointsExpiryDate: null,
    rawText: null,
    rawTextExpiresAt: null,
    autoFinalizeAt: null,
    linkStatus: 'linked',
    cardHint: null,
    category: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...partial,
  };
}

describe('parseStatementLlmJson', () => {
  it('extracts valid line items and statement fields from fixture JSON', () => {
    const result = parseStatementLlmJson(SAMPLE_MODEL_JSON);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data } = result;
    expect(data.statement_period_start).toBe('2026-06-01');
    expect(data.statement_period_end).toBe('2026-06-30');
    expect(data.total_spend).toBe(84250.5);
    expect(data.minimum_due).toBe(4200);
    expect(data.total_due).toBe(84250.5);
    expect(data.payment_due_date).toBe('2026-07-18');
    expect(data.reward_points_earned).toBe(1250);

    // Lounge 0 amount + bad rows dropped → 7 valid purchases.
    expect(data.line_items.map((l) => l.merchant)).toEqual(EXPECTED_MERCHANTS);
    expect(data.line_items).toHaveLength(7);
  });

  it('recovers JSON inside markdown fences', () => {
    const fenced = '```json\n' + SAMPLE_MODEL_JSON + '\n```';
    const result = parseStatementLlmJson(fenced);
    expect(result.ok).toBe(true);
  });

  it('does not crash on malformed output', () => {
    expect(parseStatementLlmJson('not json at all').ok).toBe(false);
    expect(parseStatementLlmJson('{"line_items":[]}').ok).toBe(false);
    expect(
      parseStatementLlmJson(
        '{"statement_period_start":"x","statement_period_end":"y","line_items":[]}',
      ).ok,
    ).toBe(false);
  });

  it('sums line items when total_spend is null', () => {
    const result = parseStatementLlmJson(`{
      "statement_period_start": "2026-06-01",
      "statement_period_end": "2026-06-30",
      "total_spend": null,
      "line_items": [
        {"date":"2026-06-01","merchant":"A","amount":100.5,"category":"other"},
        {"date":"2026-06-02","merchant":"B","amount":50,"category":"fuel"}
      ]
    }`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total_spend).toBe(150.5);
  });
});

describe('planStatementMerge', () => {
  const lines: StatementLineItem[] = [
    {
      date: '2026-06-03',
      merchant: 'AMAZON PAY INDIA',
      amount: 12999,
      category: 'shopping',
    },
    {
      date: '2026-06-05',
      merchant: 'SWIGGY',
      amount: 890,
      category: 'dining',
    },
  ];

  it('inserts unmatched lines and backfills category on overlaps', () => {
    const existing = [
      txn({
        id: 't1',
        amount: 12999,
        transactionDate: '2026-06-03',
        category: null,
      }),
    ];
    const actions = planStatementMerge({
      lines,
      existing,
      cardId: 'c1',
    });
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      kind: 'backfill_category',
      existingId: 't1',
    });
    expect(actions[1]).toMatchObject({ kind: 'insert' });
  });

  it('skips duplicates that already have a category', () => {
    const existing = [
      txn({
        id: 't1',
        amount: 12999,
        transactionDate: '2026-06-03',
        category: 'shopping',
      }),
    ];
    const actions = planStatementMerge({
      lines: [lines[0]!],
      existing,
      cardId: 'c1',
    });
    expect(actions[0]?.kind).toBe('skip_duplicate');
  });

  it('matches with amount tolerance under 2 paise', () => {
    const match = findStatementOverlap(
      { date: '2026-06-03', merchant: 'X', amount: 100.005, category: 'other' },
      [txn({ id: 't1', amount: 100, transactionDate: '2026-06-03' })],
      'c1',
      new Set(),
    );
    expect(match?.id).toBe('t1');
  });
});

describe('statement summary helpers', () => {
  it('builds category breakdown and notables', () => {
    const result = parseStatementLlmJson(SAMPLE_MODEL_JSON);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const breakdown = buildCategoryBreakdown(result.data.line_items);
    expect(breakdown.shopping).toBeCloseTo(12999 + 8999.5);
    expect(breakdown.travel).toBe(24500);
    const notables = pickNotableTransactions(result.data.line_items, 3);
    expect(notables.map((n) => n.merchant)).toEqual([
      'MAKE MY TRIP',
      'AMAZON PAY INDIA',
      'FLIPKART',
    ]);
  });

  it('estimates rewards from benefit prose when statement points missing', () => {
    const pts = estimateRewardPoints({
      lines: [
        { date: '2026-06-01', merchant: 'A', amount: 10000, category: 'shopping' },
      ],
      benefitDescriptions: ['5% cashback on Amazon and Flipkart shopping'],
    });
    expect(pts).toBe(500);
  });
});

/**
 * Fixture accuracy report — compares parsed output to the known-good merchants
 * and totals embedded in SAMPLE_MODEL_JSON (simulates Claude structured output
 * for a text-based bank statement).
 */
describe('statement fixture accuracy', () => {
  it('recovers all expected purchase rows and period totals', () => {
    const result = parseStatementLlmJson(SAMPLE_MODEL_JSON);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const merchants = new Set(result.data.line_items.map((l) => l.merchant));
    const hit = EXPECTED_MERCHANTS.filter((m) => merchants.has(m)).length;
    const precision = hit / EXPECTED_MERCHANTS.length;
    // Defensive parse must keep every valid row from a well-formed model reply.
    expect(precision).toBe(1);
    expect(result.data.total_spend).toBe(84250.5);
    expect(result.data.reward_points_earned).toBe(1250);
  });
});
